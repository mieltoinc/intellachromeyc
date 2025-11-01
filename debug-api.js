// Quick API Debug Script
// Run this in the browser console on the extension page to diagnose the issue

async function debugAPI() {
  console.log('🔍 Debugging Intella API Configuration...');
  
  try {
    // Check if background script is available
    const backgroundResponse = await chrome.runtime.sendMessage({
      type: 'GET_SETTINGS'
    });
    
    console.log('⚙️ Settings:', backgroundResponse);
    
    if (!backgroundResponse.success) {
      console.error('❌ Failed to get settings from background script');
      return;
    }
    
    const settings = backgroundResponse.data;
    
    // Check critical settings
    console.log('🔧 API Configuration:');
    console.log('  • API URL:', settings.apiUrl || 'NOT SET (using default)');
    console.log('  • API Key:', settings.apiKey ? '✅ SET' : '❌ NOT SET');
    console.log('  • Workspace ID:', settings.workspace_id || 'NOT SET');
    
    // Test basic connectivity
    if (settings.apiUrl || settings.apiUrl === '') {
      const testUrl = settings.apiUrl || 'http://localhost:8000';
      console.log(`🌐 Testing connectivity to: ${testUrl}`);
      
      try {
        const testResponse = await fetch(`${testUrl}/health`, { 
          method: 'GET',
          headers: { 'Content-Type': 'application/json' }
        });
        console.log(`✅ Server reachable: ${testResponse.status} ${testResponse.statusText}`);
      } catch (fetchError) {
        console.error(`❌ Server unreachable:`, fetchError.message);
        
        if (testUrl.includes('localhost')) {
          console.log('💡 TIP: Make sure your local backend server is running on port 8000');
        }
      }
    }
    
    // Test memory fetch
    console.log('🧠 Testing memory fetch...');
    try {
      const memoryResponse = await chrome.runtime.sendMessage({
        type: 'GET_BACKEND_MEMORIES'
      });
      
      if (memoryResponse.success) {
        console.log(`✅ Memory fetch successful: ${memoryResponse.data.length} memories`);
      } else {
        console.error('❌ Memory fetch failed:', memoryResponse.error);
        
        // Provide specific troubleshooting
        if (memoryResponse.error.includes('Failed to fetch')) {
          console.log('💡 TIP: This usually means:');
          console.log('   - Backend server is not running');
          console.log('   - Wrong API URL in settings');
          console.log('   - Network/firewall blocking request');
        }
        
        if (memoryResponse.error.includes('401') || memoryResponse.error.includes('unauthorized')) {
          console.log('💡 TIP: Authentication issue - check your API key or login status');
        }
        
        if (memoryResponse.error.includes('403') || memoryResponse.error.includes('forbidden')) {
          console.log('💡 TIP: Permission issue - check workspace_id and user permissions');
        }
      }
    } catch (memoryError) {
      console.error('❌ Memory fetch error:', memoryError);
    }
    
  } catch (error) {
    console.error('❌ Debug failed:', error);
  }
}

// Run the debug
debugAPI();