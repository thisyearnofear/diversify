import type { NextApiRequest, NextApiResponse } from 'next';
import formidable from 'formidable';
import fs from 'fs';
import OpenAI from 'openai';

export const config = {
    api: {
        bodyParser: false,
    },
};

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    if (!process.env.OPENAI_API_KEY) {
        return res.status(500).json({ error: 'OpenAI API key not configured' });
    }

    try {
        const form = formidable({});
        const [fields, files] = await form.parse(req);

        const audioFile = files.audio?.[0];
        if (!audioFile) {
            return res.status(400).json({ error: 'No audio file provided' });
        }

        const transcription = await openai.audio.transcriptions.create({
            file: fs.createReadStream(audioFile.filepath),
            model: 'whisper-1',
        });

        res.status(200).json({ text: transcription.text });
    } catch (error: any) {
        console.error('[Transcribe API] Error:', error);
        res.status(500).json({ error: error.message || 'Failed to transcribe audio' });
    }
}
