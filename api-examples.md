# STLix External API Documentation

## Overview

STLix provides a comprehensive RESTful API that allows external developers to generate videos using our AI-powered STLix Fast model. The API supports both text-to-video and image-to-video generation with simple HTTP requests.

## Authentication

All API requests require authentication using an API key in the Authorization header:

```
Authorization: Bearer stlix_your_api_key_here
```

## Base URL

```
https://your-domain.replit.app/api/external
```

## Rate Limits

Each API key has a monthly credit limit. Credits are consumed as follows:
- Text-to-video: 5 credits per generation
- Image-to-video: 8 credits per generation

## Endpoints

### 1. Text-to-Video Generation

Generate videos from text prompts using the STLix Fast model.

**Endpoint:** `POST /api/external/generate/text-to-video`

**Request Body:**
```json
{
  "prompt": "A beautiful sunset over the ocean with waves gently crashing",
  "aspectRatio": "16:9",
  "watermark": "STLix"
}
```

**Parameters:**
- `prompt` (required): Text description of the video to generate
- `aspectRatio` (optional): Video aspect ratio, "16:9" or "9:16" (default: "16:9")
- `watermark` (optional): Watermark text to add to the video

**Example using JavaScript:**
```javascript
const response = await fetch('https://your-domain.replit.app/api/external/generate/text-to-video', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer stlix_your_api_key_here',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    prompt: 'A serene mountain landscape with flowing rivers',
    aspectRatio: '16:9'
  })
});

const result = await response.json();
console.log(result);
// {
//   "success": true,
//   "taskId": "task_12345",
//   "generationId": "gen_67890",
//   "status": "processing",
//   "creditsUsed": 5
// }
```

### 2. Image-to-Video Generation

Generate videos from an image with motion description.

**Endpoint:** `POST /api/external/generate/image-to-video`

**Request:** Multipart form data with:
- `image` (required): Image file (JPEG, PNG)
- `prompt` (required): Description of desired motion
- `aspectRatio` (optional): Video aspect ratio

**Example using JavaScript:**
```javascript
const formData = new FormData();
formData.append('image', imageFile); // File object from input
formData.append('prompt', 'Make the clouds move slowly across the sky');
formData.append('aspectRatio', '16:9');

const response = await fetch('https://your-domain.replit.app/api/external/generate/image-to-video', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer stlix_your_api_key_here'
  },
  body: formData
});

const result = await response.json();
console.log(result);
// {
//   "success": true,
//   "taskId": "task_12345",
//   "generationId": "gen_67890",
//   "status": "processing",
//   "creditsUsed": 8,
//   "imageUrl": "https://..."
// }
```

### 3. Check Generation Status

Check the status and get results of a video generation.

**Endpoint:** `GET /api/external/status/:taskId`

**Example using JavaScript:**
```javascript
const response = await fetch('https://your-domain.replit.app/api/external/status/task_12345', {
  headers: {
    'Authorization': 'Bearer stlix_your_api_key_here'
  }
});

const result = await response.json();
console.log(result);
// {
//   "taskId": "task_12345",
//   "status": "completed",
//   "resultUrls": ["https://video-url.mp4"],
//   "createdAt": "2025-01-01T00:00:00Z",
//   "completedAt": "2025-01-01T00:02:30Z"
// }
```

**Status Values:**
- `pending`: Generation queued
- `processing`: Video being generated
- `completed`: Generation finished successfully
- `failed`: Generation failed (check `errorMessage`)

### 4. Check API Key Usage

Monitor your credit usage and limits.

**Endpoint:** `GET /api/external/usage`

**Example using JavaScript:**
```javascript
const response = await fetch('https://your-domain.replit.app/api/external/usage', {
  headers: {
    'Authorization': 'Bearer stlix_your_api_key_here'
  }
});

const result = await response.json();
console.log(result);
// {
//   "creditsUsed": 45,
//   "creditsLimit": 100,
//   "creditsRemaining": 55,
//   "lastUsed": "2025-01-01T12:00:00Z",
//   "lastResetAt": "2025-01-01T00:00:00Z"
// }
```

## Error Responses

All endpoints return consistent error responses:

```json
{
  "error": "Error message",
  "creditsUsed": 45,
  "creditsLimit": 100,
  "creditsNeeded": 5
}
```

**Common Error Codes:**
- `401`: Invalid API key or authentication failed
- `429`: Monthly credit limit exceeded
- `400`: Invalid request parameters
- `503`: Service temporarily unavailable
- `500`: Internal server error

## Complete Example: Text-to-Video with Status Polling

```javascript
class STLixAPI {
  constructor(apiKey, baseUrl = 'https://your-domain.replit.app/api/external') {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
  }

  async generateTextToVideo(prompt, options = {}) {
    const response = await fetch(`${this.baseUrl}/generate/text-to-video`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        prompt,
        aspectRatio: options.aspectRatio || '16:9',
        watermark: options.watermark
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Generation failed');
    }

    return await response.json();
  }

  async checkStatus(taskId) {
    const response = await fetch(`${this.baseUrl}/status/${taskId}`, {
      headers: {
        'Authorization': `Bearer ${this.apiKey}`
      }
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Status check failed');
    }

    return await response.json();
  }

  async waitForCompletion(taskId, maxWaitTime = 300000) { // 5 minutes
    const startTime = Date.now();
    
    while (Date.now() - startTime < maxWaitTime) {
      const status = await this.checkStatus(taskId);
      
      if (status.status === 'completed') {
        return status;
      } else if (status.status === 'failed') {
        throw new Error(status.errorMessage || 'Generation failed');
      }
      
      // Wait 10 seconds before next check
      await new Promise(resolve => setTimeout(resolve, 10000));
    }
    
    throw new Error('Generation timed out');
  }

  async getUsage() {
    const response = await fetch(`${this.baseUrl}/usage`, {
      headers: {
        'Authorization': `Bearer ${this.apiKey}`
      }
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Usage check failed');
    }

    return await response.json();
  }
}

// Usage example
async function main() {
  const stlix = new STLixAPI('stlix_your_api_key_here');

  try {
    // Check current usage
    const usage = await stlix.getUsage();
    console.log('Current usage:', usage);

    // Generate video
    const generation = await stlix.generateTextToVideo(
      'A peaceful garden with butterflies flying around colorful flowers'
    );
    console.log('Generation started:', generation);

    // Wait for completion
    const result = await stlix.waitForCompletion(generation.taskId);
    console.log('Video completed:', result.resultUrls[0]);

  } catch (error) {
    console.error('Error:', error.message);
  }
}

main();
```

## Python Example

```python
import requests
import time
import json

class STLixAPI:
    def __init__(self, api_key, base_url='https://your-domain.replit.app/api/external'):
        self.api_key = api_key
        self.base_url = base_url
        self.headers = {'Authorization': f'Bearer {api_key}'}

    def generate_text_to_video(self, prompt, aspect_ratio='16:9', watermark=None):
        data = {
            'prompt': prompt,
            'aspectRatio': aspect_ratio
        }
        if watermark:
            data['watermark'] = watermark

        response = requests.post(
            f'{self.base_url}/generate/text-to-video',
            headers={**self.headers, 'Content-Type': 'application/json'},
            json=data
        )
        response.raise_for_status()
        return response.json()

    def generate_image_to_video(self, image_path, prompt, aspect_ratio='16:9'):
        with open(image_path, 'rb') as f:
            files = {'image': f}
            data = {
                'prompt': prompt,
                'aspectRatio': aspect_ratio
            }
            response = requests.post(
                f'{self.base_url}/generate/image-to-video',
                headers=self.headers,
                files=files,
                data=data
            )
        response.raise_for_status()
        return response.json()

    def check_status(self, task_id):
        response = requests.get(
            f'{self.base_url}/status/{task_id}',
            headers=self.headers
        )
        response.raise_for_status()
        return response.json()

    def wait_for_completion(self, task_id, max_wait_time=300):
        start_time = time.time()
        
        while time.time() - start_time < max_wait_time:
            status = self.check_status(task_id)
            
            if status['status'] == 'completed':
                return status
            elif status['status'] == 'failed':
                raise Exception(status.get('errorMessage', 'Generation failed'))
            
            time.sleep(10)  # Wait 10 seconds
        
        raise Exception('Generation timed out')

    def get_usage(self):
        response = requests.get(
            f'{self.base_url}/usage',
            headers=self.headers
        )
        response.raise_for_status()
        return response.json()

# Usage example
if __name__ == '__main__':
    stlix = STLixAPI('stlix_your_api_key_here')
    
    try:
        # Check usage
        usage = stlix.get_usage()
        print('Current usage:', usage)
        
        # Generate video
        generation = stlix.generate_text_to_video(
            'A majestic eagle soaring over snow-capped mountains'
        )
        print('Generation started:', generation)
        
        # Wait for completion
        result = stlix.wait_for_completion(generation['taskId'])
        print('Video completed:', result['resultUrls'][0])
        
    except Exception as e:
        print('Error:', str(e))
```

## Support

For API support or questions, please contact our development team or check our documentation for updates.