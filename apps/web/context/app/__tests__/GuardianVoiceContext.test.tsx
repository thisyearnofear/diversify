import React from 'react';
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GuardianVoiceProvider, useGuardianVoice } from '../GuardianVoiceContext';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}

class Recorder {
  static isTypeSupported = (type: string) => type.startsWith('audio/webm');
  static latest: Recorder;
  state = 'inactive';
  mimeType = 'audio/webm';
  ondataavailable: ((event: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;
  onerror: (() => void) | null = null;
  constructor() { Recorder.latest = this; }
  start() { this.state = 'recording'; }
  stop() {
    this.state = 'inactive';
    this.ondataavailable?.({ data: new Blob(['audio'], { type: this.mimeType }) });
    this.onstop?.();
  }
}

const trackStop = vi.fn();
const stream = { getTracks: () => [{ stop: trackStop }] } as unknown as MediaStream;
const getUserMedia = vi.fn();
const revokeObjectURL = vi.fn();
const createObjectURL = vi.fn();
const players: Array<{
  play: ReturnType<typeof vi.fn>; pause: ReturnType<typeof vi.fn>;
  removeAttribute: ReturnType<typeof vi.fn>; onended: (() => void) | null; onerror: (() => void) | null;
}> = [];
const AudioMock = vi.fn(() => {
  const player = { play: vi.fn().mockResolvedValue(undefined), pause: vi.fn(), removeAttribute: vi.fn(), onended: null, onerror: null };
  players.push(player);
  return player;
});
const originalMediaDevices = Object.getOwnPropertyDescriptor(navigator, 'mediaDevices');

beforeEach(() => {
  vi.clearAllMocks();
  players.length = 0;
  getUserMedia.mockResolvedValue(stream);
  createObjectURL.mockImplementation(() => `blob:voice-${players.length}`);
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia } });
  vi.stubGlobal('MediaRecorder', Recorder);
  vi.stubGlobal('Audio', AudioMock);
  vi.stubGlobal('URL', { createObjectURL, revokeObjectURL });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  if (originalMediaDevices) Object.defineProperty(navigator, 'mediaDevices', originalMediaDevices);
  else Reflect.deleteProperty(navigator, 'mediaDevices');
});

function session() {
  return renderHook(() => useGuardianVoice()!, { wrapper: GuardianVoiceProvider });
}

describe('Guardian voice lifecycle', () => {
  it('discards a duration-limited recording instead of dispatching a clipped instruction', async () => {
    vi.useFakeTimers();
    const { result } = session();
    const transcribe = vi.fn();
    const dispatch = vi.fn();
    await act(() => result.current.start(transcribe, dispatch));
    await act(() => vi.advanceTimersByTimeAsync(30_000));
    expect(result.current.error).toContain('30-second limit');
    expect(trackStop).toHaveBeenCalledOnce();
    expect(transcribe).not.toHaveBeenCalled();
    expect(dispatch).not.toHaveBeenCalled();
  });
  it('records one explicit turn, releases the mic, and dispatches the transcript once', async () => {
    const { result } = session();
    const transcribe = vi.fn().mockResolvedValue('Show me the naira');
    const dispatch = vi.fn();
    await act(() => result.current.start(transcribe, dispatch));
    expect(result.current.phase).toBe('listening');
    expect(trackStop).not.toHaveBeenCalled();
    expect(dispatch).not.toHaveBeenCalled();
    await act(async () => { result.current.finish(); });
    expect(trackStop).toHaveBeenCalledOnce();
    expect(transcribe.mock.calls[0][0].type).toBe('audio/webm');
    expect(result.current.transcript).toBe('Show me the naira');
    expect(dispatch).toHaveBeenCalledOnce();
    expect(dispatch).toHaveBeenCalledWith('Show me the naira');
    expect(result.current.phase).toBe('idle');
  });

  it('releases a late permission grant after the user cancels', async () => {
    const granted = deferred<MediaStream>();
    getUserMedia.mockReturnValue(granted.promise);
    const { result } = session();
    let starting!: Promise<void>;
    act(() => { starting = result.current.start(vi.fn(), vi.fn()); });
    expect(result.current.phase).toBe('requesting_permission');
    act(() => result.current.stop());
    await act(async () => { granted.resolve(stream); await starting; });
    expect(trackStop).toHaveBeenCalledOnce();
    expect(result.current.phase).toBe('idle');
  });

  it('does not dispatch a transcription that completes after cancellation', async () => {
    const heard = deferred<string>();
    const dispatch = vi.fn();
    const { result } = session();
    await act(() => result.current.start(() => heard.promise, dispatch));
    act(() => result.current.finish());
    expect(result.current.phase).toBe('transcribing');
    act(() => result.current.stop());
    await act(async () => { heard.resolve('send fifty'); });
    expect(dispatch).not.toHaveBeenCalled();
    expect(result.current.transcript).toBe('');
  });

  it('keeps typing available when microphone permission is denied', async () => {
    getUserMedia.mockRejectedValue(new DOMException('denied', 'NotAllowedError'));
    const { result } = session();
    await act(() => result.current.start(vi.fn(), vi.fn()));
    expect(result.current.phase).toBe('error');
    expect(result.current.error).toMatch(/permission.*denied.*type/i);
  });

  it('stops a granted stream if the browser cannot create its recorder', async () => {
    vi.stubGlobal('MediaRecorder', class extends Recorder { constructor() { super(); throw new Error('codec unavailable'); } });
    const { result } = session();
    await act(() => result.current.start(vi.fn(), vi.fn()));
    expect(trackStop).toHaveBeenCalled();
    expect(result.current.phase).toBe('error');
  });

  it('aborts stale TTS and never starts its audio after interruption', async () => {
    const generated = deferred<Blob>();
    const generate = vi.fn(() => generated.promise);
    const { result } = session();
    let speaking!: Promise<void>;
    act(() => { speaking = result.current.speak('Old response', generate); });
    act(() => result.current.stop());
    expect((generate.mock.calls[0] as unknown as [string, AbortSignal])[1].aborted).toBe(true);
    await act(async () => { generated.resolve(new Blob(['old'])); await speaking; });
    expect(AudioMock).not.toHaveBeenCalled();
  });

  it('has one player and revokes URLs on replacement and completion', async () => {
    const { result } = session();
    const generate = vi.fn().mockResolvedValue(new Blob(['speech']));
    await act(() => result.current.speak('First', generate));
    await act(() => result.current.speak('Second', generate));
    expect(players[0].pause).toHaveBeenCalledOnce();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:voice-0');
    act(() => players[1].onended?.());
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:voice-1');
    expect(result.current.phase).toBe('idle');
  });

  it('stops resources on unmount without submitting unfinished audio', async () => {
    const { result, unmount } = session();
    const transcribe = vi.fn();
    await act(() => result.current.start(transcribe, vi.fn()));
    unmount();
    expect(trackStop).toHaveBeenCalledOnce();
    expect(transcribe).not.toHaveBeenCalled();
  });

  it('ends the session when the page becomes hidden', async () => {
    const { result } = session();
    await act(() => result.current.speak('A response', vi.fn().mockResolvedValue(new Blob(['audio']))));
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
    act(() => document.dispatchEvent(new Event('visibilitychange')));
    expect(players[0].pause).toHaveBeenCalledOnce();
    expect(result.current.active).toBe(false);
    expect(result.current.phase).toBe('idle');
  });

  it('exposes a text fallback and replay when browser playback is blocked', async () => {
    AudioMock.mockImplementationOnce(() => {
      const player = { play: vi.fn().mockRejectedValue(new Error('autoplay')), pause: vi.fn(), removeAttribute: vi.fn(), onended: null, onerror: null };
      players.push(player);
      return player;
    });
    const { result } = session();
    await act(() => result.current.speak('Text is still visible', vi.fn().mockResolvedValue(new Blob(['audio']))));
    expect(result.current.reply).toBe('Text is still visible');
    expect(result.current.error).toMatch(/Read the response/);
    expect(result.current.canReplay).toBe(true);
    expect(revokeObjectURL).toHaveBeenCalledOnce();
  });
});
