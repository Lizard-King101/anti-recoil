import { concat, hexlify, keccak256, toUtf8Bytes } from 'ethers/lib/utils'
import uts46 from 'idna-uts46-hx'
import { decodeLabelhash, isEncodedLabelhash } from './labels'

const zeros = new Uint8Array(32)
zeros.fill(0)

export const normalise = (name: string) =>
  name ? uts46.toUnicode(name, { useStd3ASCII: true }) : name

export const namehash = (name: string): [string, string] => {
  let result: string | Uint8Array = zeros
  let labelSha: string = '';

  if (name) {
    const labels = name.split('.')
    for (let i = labels.length - 1; i >= 0; i -= 1) {
      if (isEncodedLabelhash(labels[i])) {
        labelSha = decodeLabelhash(labels[i])
      } else {
        const normalised = normalise(labels[i])
        labelSha = keccak256(toUtf8Bytes(normalised))
      }
      console.log('Result:', result, ', Label:', labelSha);
      result = keccak256(concat([result, labelSha]));
    }
  } else {
    result = hexlify(zeros)
  }
  // console.log('Normalize:', result);
  return [result, labelSha] as [string, string];
}

// lebel = keccak256(abi.encodePacked(Strings.toString(count)))

// root

// subDomain = keccak256(abi.encodePacked(
//   root,
//   label
// ))