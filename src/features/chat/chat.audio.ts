function float32ToInt16(input: Float32Array) {
  const output = new Int16Array(input.length)
  for (let index = 0; index < input.length; index += 1) {
    const sample = Math.max(-1, Math.min(1, input[index] || 0))
    output[index] = sample < 0 ? sample * 0x8000 : sample * 0x7fff
  }
  return output
}

function int16ToLittleEndianBytes(input: Int16Array) {
  const bytes = new Uint8Array(input.length * 2)
  const view = new DataView(bytes.buffer)
  for (let index = 0; index < input.length; index += 1) {
    view.setInt16(index * 2, input[index] || 0, true)
  }
  return bytes
}

function toBase64FromBytes(bytes: Uint8Array) {
  let binary = ''
  const chunkSize = 0x8000
  for (let index = 0; index < bytes.length; index += chunkSize) {
    const chunk = bytes.subarray(index, index + chunkSize)
    binary += String.fromCharCode(...chunk)
  }
  return btoa(binary)
}

function convertAudioBufferToPcm16k(audioBuffer: AudioBuffer) {
  const source = audioBuffer.getChannelData(0)
  const targetRate = 16_000
  const ratio = audioBuffer.sampleRate / targetRate
  const outputLength = Math.max(1, Math.floor(source.length / ratio))
  const resampled = new Float32Array(outputLength)
  let offsetResult = 0
  let offsetSource = 0

  while (offsetResult < outputLength) {
    const nextOffset = Math.min(source.length, Math.floor((offsetResult + 1) * ratio))
    let accumulator = 0
    let count = 0

    while (offsetSource < nextOffset) {
      accumulator += source[offsetSource] || 0
      offsetSource += 1
      count += 1
    }

    resampled[offsetResult] = count > 0 ? accumulator / count : 0
    offsetResult += 1
  }

  const pcmInt16 = float32ToInt16(resampled)
  return int16ToLittleEndianBytes(pcmInt16)
}

export async function convertBlobToPcmBase64(blob: Blob) {
  const arrayBuffer = await blob.arrayBuffer()
  const decodingContext = new AudioContext()

  try {
    const audioBuffer = await decodingContext.decodeAudioData(arrayBuffer.slice(0))
    const pcmBytes = convertAudioBufferToPcm16k(audioBuffer)
    return toBase64FromBytes(pcmBytes)
  } finally {
    await decodingContext.close()
  }
}
