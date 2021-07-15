export const abi = [
  {
    constant: false,
    inputs: [
      { name: 'message', type: 'bytes' },
      { name: 'signatures', type: 'bytes' },
    ],
    name: 'executeSignatures',
    outputs: [],
    payable: false,
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    constant: false,
    inputs: [
      { name: '_sender', type: 'address' },
      { name: '_receiver', type: 'address' },
      { name: '_amount', type: 'uint256' },
    ],
    name: 'relayTokens',
    outputs: [],
    payable: false,
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    constant: true,
    inputs: [{ name: '_txHash', type: 'bytes32' }],
    name: 'relayedMessages',
    outputs: [{ name: '', type: 'bool' }],
    payable: false,
    stateMutability: 'view',
    type: 'function',
  },
]

export const omniBridgeAbi = [
  {
    type: 'function',
    stateMutability: 'view',
    payable: false,
    outputs: [{ type: 'bool', name: '' }],
    name: 'messageCallStatus',
    inputs: [{ type: 'bytes32', name: '_messageId' }],
    constant: true,
  },
]

export const xdaiBridgeAbi = [
  {
    type: 'function',
    stateMutability: 'payable',
    payable: true,
    outputs: [],
    name: 'relayTokens',
    inputs: [{ type: 'address', name: '_receiver' }],
    constant: false,
  },
]

export const multiClaimAbi = [
  {
    inputs: [
      { internalType: 'address[]', name: 'bridges', type: 'address[]' },
      { internalType: 'bytes[]', name: 'messages', type: 'bytes[]' },
      { internalType: 'bytes[]', name: 'signatures', type: 'bytes[]' },
    ],
    name: 'claim',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
]
export const omenAbi = [
  {
    type: 'function',
    stateMutability: 'nonpayable',
    payable: false,
    outputs: [{ type: 'bool', name: '' }],
    name: 'transferAndCall',
    inputs: [
      { type: 'address', name: '_to' },
      { type: 'uint256', name: '_value' },
      { type: 'bytes', name: '_data' },
    ],
    constant: false,
  },
]
export const approveAbi = [
  {
    type: 'function',
    stateMutability: 'nonpayable',
    payable: false,
    outputs: [{ type: 'bool', name: '' }],
    name: 'approve',
    inputs: [
      { type: 'address', name: '_spender' },
      { type: 'uint256', name: '_value' },
    ],
    constant: false,
  },
]
