/**
 * Farcaster Mini App Webhook Endpoint
 * Handles frame interactions and events from Farcaster
 * Compatible with 2026 Farcaster Mini App Standards
 */

import { NextApiRequest, NextApiResponse } from 'next';

// Define types inline since @farcaster/miniapp-sdk doesn't export these webhook types
interface FarcasterFrameAction {
  type: 'frame_action';
  action: string;
  fid: number;
  username: string;
  timestamp: number;
  frameUrl: string;
  buttonIndex: number;
  inputText?: string;
  state?: unknown;
}

interface FarcasterFrameEvent {
  type: 'frame_event';
  event: string;
  fid: number;
  username: string;
  timestamp: number;
  frameUrl: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Parse the incoming webhook payload
    const payload = req.body;
    
    // Validate the payload structure
    if (!payload || typeof payload !== 'object') {
      return res.status(400).json({ error: 'Invalid payload format' });
    }

    // Log the incoming event for debugging
    console.log('[Farcaster Webhook] Received event:', JSON.stringify(payload, null, 2));

    // Handle different types of Farcaster frame events
    if (payload.type === 'frame_action') {
      // Handle frame actions (button clicks, etc.)
      const action = payload as FarcasterFrameAction;
      await handleFrameAction(action, res);
    } 
    else if (payload.type === 'frame_event') {
      // Handle frame lifecycle events
      const event = payload as FarcasterFrameEvent;
      await handleFrameEvent(event, res);
    }
    else {
      // Unknown event type
      console.warn('[Farcaster Webhook] Unknown event type:', payload.type);
      return res.status(400).json({ error: 'Unknown event type' });
    }

  } catch (error) {
    console.error('[Farcaster Webhook] Error processing request:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

/**
 * Handle frame actions (button clicks, etc.)
 */
async function handleFrameAction(action: FarcasterFrameAction, res: NextApiResponse) {
  console.log('[Farcaster Webhook] Handling frame action:', action.action);

  try {
    // Extract relevant data from the action
    const { 
      action: actionType,
      fid,
      username,
      buttonIndex,
      inputText,
      state
    } = action;

    // Log the action details
    console.log(`[Farcaster Action] User ${username} (FID: ${fid}) performed action: ${actionType}`);

    // Handle different action types
    switch (actionType) {
      case 'button_click':
        await handleButtonClick(buttonIndex, inputText, fid, username, state);
        break;
      
      case 'input_submit':
        await handleInputSubmit(inputText, fid, username, state);
        break;
      
      default:
        console.log(`[Farcaster Action] Unknown action type: ${actionType}`);
    }

    // Return success response
    return res.status(200).json({
      success: true,
      message: 'Frame action processed successfully'
    });

  } catch (error) {
    console.error('[Farcaster Webhook] Error handling frame action:', error);
    return res.status(500).json({
      error: 'Failed to process frame action',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

/**
 * Handle frame lifecycle events
 */
async function handleFrameEvent(event: FarcasterFrameEvent, res: NextApiResponse) {
  console.log('[Farcaster Webhook] Handling frame event:', event.event);

  try {
    // Extract relevant data from the event
    const { 
      event: eventType,
      fid,
      username
    } = event;

    // Log the event details
    console.log(`[Farcaster Event] User ${username} (FID: ${fid}) triggered event: ${eventType}`);

    // Handle different event types
    switch (eventType) {
      case 'frame_load':
        console.log(`[Farcaster Event] Frame loaded for user ${username}`);
        break;
      
      case 'frame_error':
        console.error(`[Farcaster Event] Frame error for user ${username}`);
        break;
      
      case 'frame_close':
        console.log(`[Farcaster Event] Frame closed by user ${username}`);
        break;
      
      default:
        console.log(`[Farcaster Event] Unknown event type: ${eventType}`);
    }

    // Return success response
    return res.status(200).json({
      success: true,
      message: 'Frame event processed successfully'
    });

  } catch (error) {
    console.error('[Farcaster Webhook] Error handling frame event:', error);
    return res.status(500).json({
      error: 'Failed to process frame event',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

/**
 * Handle button click actions
 */
async function handleButtonClick(
  buttonIndex: number,
  inputText: string | undefined,
  fid: number,
  username: string,
  state: unknown
) {
  console.log(`[Farcaster Action] Button ${buttonIndex} clicked by ${username}`);
  
  // Here you would implement your specific business logic
  // For example: connect wallet, switch network, perform swap, etc.
  
  // Log to analytics or database
  console.log('[Farcaster Analytics] Button click event:', {
    fid,
    username,
    buttonIndex,
    inputText,
    state,
    timestamp: new Date().toISOString()
  });
  
  // You could also trigger specific actions based on button index
  switch (buttonIndex) {
    case 1:
      console.log('[Farcaster Action] Primary button clicked');
      // Could trigger wallet connection or main action
      break;
    
    case 2:
      console.log('[Farcaster Action] Secondary button clicked');
      // Could trigger secondary action or settings
      break;
    
    default:
      console.log(`[Farcaster Action] Button ${buttonIndex} clicked`);
  }
}

/**
 * Handle input submit actions
 */
async function handleInputSubmit(
  inputText: string | undefined,
  fid: number,
  username: string,
  state: unknown
) {
  if (!inputText) {
    console.warn('[Farcaster Action] Input submit with empty text');
    return;
  }
  
  console.log(`[Farcaster Action] Input submitted by ${username}: ${inputText}`);
  
  // Here you would implement your specific business logic
  // For example: process user input, search, etc.
  
  // Log to analytics or database
  console.log('[Farcaster Analytics] Input submit event:', {
    fid,
    username,
    inputText,
    state,
    timestamp: new Date().toISOString()
  });
}

// Export the config for API route
// This is required for Next.js API routes
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '1mb',
    },
    externalResolver: true,
  },
};