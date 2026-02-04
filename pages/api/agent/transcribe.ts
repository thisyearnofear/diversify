import type { NextApiRequest, NextApiResponse } from 'next';
import formidable from 'formidable';
import { AIService } from '../../../services/ai/ai-service';

export const config = {
    api: {
        bodyParser: false,
    },
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const form = formidable({
            keepExtensions: true,
            maxFiles: 1,
            maxFileSize: 10 * 1024 * 1024, // 10MB
        });
        const [, files] = await form.parse(req);

        const audioFile = files.audio?.[0];
        if (!audioFile) {
            return res.status(400).json({ error: 'No audio file provided' });
        }

        // Use unified AI Service with failover (OpenAI -> Venice)
        const transcription = await AIService.transcribe(
            audioFile.filepath
        );

        res.status(200).json({ 
            text: transcription.text,
            provider: transcription.provider 
        });
    } catch (error) {
        console.error('[Transcribe API] Error:', error);
        res.status(500).json({ error: (error as Error).message || 'Failed to transcribe audio' });
    }
}
