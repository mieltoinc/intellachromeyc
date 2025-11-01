import logging
import json
import os

from dotenv import load_dotenv
from livekit.agents import (
    Agent,
    AgentSession,
    JobContext,
    JobProcess,
    MetricsCollectedEvent,
    RoomInputOptions,
    WorkerOptions,
    cli,
    inference,
    metrics,
)
from livekit.plugins import noise_cancellation, silero, openai
from livekit.plugins.turn_detector.multilingual import MultilingualModel
# from livekit.plugins.openai.llm import LLM

logger = logging.getLogger("agent")

load_dotenv(".env.local")


class Assistant(Agent):
    def __init__(self) -> None:
        super().__init__(
            instructions="""You are a helpful voice AI assistant. The user is interacting with you via voice, even if you perceive the conversation as text.
            You eagerly assist users with their questions by providing information from your extensive knowledge.
            Your responses are concise, to the point, and without any complex formatting or punctuation including emojis, asterisks, or other symbols.
            You are curious, friendly, and have a sense of humor.""",
        )

    # To add tools, use the @function_tool decorator.
    # Here's an example that adds a simple weather tool.
    # You also have to add `from livekit.agents import function_tool, RunContext` to the top of this file
    # @function_tool
    # async def lookup_weather(self, context: RunContext, location: str):
    #     """Use this tool to look up current weather information in the given location.
    #
    #     If the location is not supported by the weather service, the tool will indicate this. You must tell the user the location's weather is unavailable.
    #
    #     Args:
    #         location: The location to look up weather information for (e.g. city name)
    #     """
    #
    #     logger.info(f"Looking up weather for {location}")
    #
    #     return "sunny with a temperature of 70 degrees."


def prewarm(proc: JobProcess):
    proc.userdata["vad"] = silero.VAD.load()


async def entrypoint(ctx: JobContext):
    # Logging setup
    # Add any other context you want in all log entries here
    ctx.log_context_fields = {
        "room": ctx.room.name,
    }
    
    # Parse room metadata (it comes as a JSON string)
    logger.info(f"Raw room metadata: {ctx.room.metadata}")
    
    # Also check for participant metadata when they join
    # We'll set up a callback to get the API key and user ID from participant metadata
    api_key = os.getenv("MIELTO_API_KEY") or os.getenv("OPENAI_API_KEY") or "your_api_key_here"
    user_id = os.getenv("MIELTO_USER_ID") or "default-user"
    
    # Check if there are already participants in the room
    logger.info(f"Current participants in room: {len(list(ctx.room.remote_participants))}")
    for participant in ctx.room.remote_participants.values():
        logger.info(f"Existing participant: {participant.identity}, attributes: {participant.attributes}")
        if participant.attributes and participant.attributes.get("api_key"):
            api_key = participant.attributes.get("api_key")
            logger.info(f"Found API key in existing participant attributes: [PRESENT]")
            break

    @ctx.room.on("participant_connected")
    def on_participant_connected(participant):
        nonlocal api_key
        logger.info(f"New participant connected: {participant.identity}")
        logger.info(f"New participant attributes: {participant.attributes}")
        
        if participant.attributes and participant.attributes.get("api_key"):
            api_key = participant.attributes.get("api_key")
            logger.info(f"Found API key in new participant attributes: [PRESENT]")
    
    # Try to parse room metadata as backup
    raw_metadata = ctx.room.metadata or ""
    try:
        metadata = json.loads(raw_metadata) if raw_metadata else {}
        logger.info(f"Parsed room metadata: {metadata}")
        if metadata.get("api_key") and api_key == "your_api_key_here":
            api_key = metadata.get("api_key")
    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse room metadata JSON: {e}")
        metadata = {}
    
    logger.info(f"Using API key: {'[PRESENT]' if api_key and api_key != 'your_api_key_here' else '[MISSING]'}")
    logger.info(f"API key starts with: {api_key[:10] if api_key and api_key != 'your_api_key_here' else 'N/A'}...")
    logger.info(f"API key length: {len(api_key) if api_key else 0}")
    logger.info(f"Using user ID: {user_id} (from env or default)")
    logger.info(f"Mielto base URL: https://api.mielto.com/api/v1")
    logger.info(f"Headers will include: X-API-Key, x-user-id, x-memories-enabled")

    # Set up a voice AI pipeline using OpenAI, Cartesia, AssemblyAI, and the LiveKit turn detector
    session = AgentSession(
        # Speech-to-text (STT) is your agent's ears, turning the user's speech into text that the LLM can understand
        # See all available models at https://docs.livekit.io/agents/models/stt/
        stt=inference.STT(model="assemblyai/universal-streaming", language="en"),
        # A Large Language Model (LLM) is your agent's brain, processing user input and generating a response
        # See all available models at https://docs.livekit.io/agents/models/llm/
        llm=openai.LLM(
            base_url="https://api.mielto.com/api/v1",
            api_key=api_key,
            extra_headers={
                "X-API-Key": api_key,
                "x-user-id": user_id,
                "x-memories-enabled": "true"
            }
        ),
        # Text-to-speech (TTS) is your agent's voice, turning the LLM's text into speech that the user can hear
        # See all available models as well as voice selections at https://docs.livekit.io/agents/models/tts/
        tts=inference.TTS(
            model="cartesia/sonic-3", voice="9626c31c-bec5-4cca-baa8-f8ba9e84c8bc"
        ),
        # VAD and turn detection are used to determine when the user is speaking and when the agent should respond
        # See more at https://docs.livekit.io/agents/build/turns
        turn_detection=MultilingualModel(),
        vad=ctx.proc.userdata["vad"],
        # allow the LLM to generate a response while waiting for the end of turn
        # See more at https://docs.livekit.io/agents/build/audio/#preemptive-generation
        preemptive_generation=True,
    )

    # To use a realtime model instead of a voice pipeline, use the following session setup instead.
    # (Note: This is for the OpenAI Realtime API. For other providers, see https://docs.livekit.io/agents/models/realtime/))
    # 1. Install livekit-agents[openai]
    # 2. Set OPENAI_API_KEY in .env.local
    # 3. Add `from livekit.plugins import openai` to the top of this file
    # 4. Use the following session setup instead of the version above
    # session = AgentSession(
    #     llm=openai.realtime.RealtimeModel(voice="marin")
    # )

    # Metrics collection, to measure pipeline performance
    # For more information, see https://docs.livekit.io/agents/build/metrics/
    usage_collector = metrics.UsageCollector()

    @session.on("metrics_collected")
    def _on_metrics_collected(ev: MetricsCollectedEvent):
        metrics.log_metrics(ev.metrics)
        usage_collector.collect(ev.metrics)

    async def log_usage():
        summary = usage_collector.get_summary()
        logger.info(f"Usage: {summary}")

    ctx.add_shutdown_callback(log_usage)

    # # Add a virtual avatar to the session, if desired
    # # For other providers, see https://docs.livekit.io/agents/models/avatar/
    # avatar = hedra.AvatarSession(
    #   avatar_id="...",  # See https://docs.livekit.io/agents/models/avatar/plugins/hedra
    # )
    # # Start the avatar and wait for it to join
    # await avatar.start(session, room=ctx.room)

    # Start the session, which initializes the voice pipeline and warms up the models
    await session.start(
        agent=Assistant(),
        room=ctx.room,
        room_input_options=RoomInputOptions(
            # For telephony applications, use `BVCTelephony` for best results
            noise_cancellation=noise_cancellation.BVC(),
        ),
    )

    # Join the room and connect to the user
    await ctx.connect()


if __name__ == "__main__":
    cli.run_app(WorkerOptions(entrypoint_fnc=entrypoint, prewarm_fnc=prewarm))
