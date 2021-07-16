import axios from 'axios'

import {
  DEFAULT_ARBITRATOR,
  EARLIEST_MAINNET_BLOCK_TO_CHECK,
  EARLIEST_RINKEBY_BLOCK_TO_CHECK,
  GRAPH_MAINNET_HTTP,
  GRAPH_MAINNET_WS,
  GRAPH_RINKEBY_HTTP,
  GRAPH_RINKEBY_WS,
  GRAPH_SOKOL_HTTP,
  GRAPH_SOKOL_WS,
  GRAPH_XDAI_HTTP,
  GRAPH_XDAI_WS,
  INFURA_PROJECT_ID,
  KLEROS_CURATE_GRAPH_MAINNET_HTTP,
  KLEROS_CURATE_GRAPH_MAINNET_WS,
  KLEROS_CURATE_GRAPH_RINKEBY_HTTP,
  KLEROS_CURATE_GRAPH_RINKEBY_WS,
} from '../common/constants'
import { entries, isNotNull } from '../util/type-utils'

import { getImageUrl } from './token'
import { waitABit } from './tools'
import { Arbitrator, Token } from './types'

export type NetworkId = 1 | 4 | 77 | 100

export const networkIds = {
  MAINNET: 1,
  RINKEBY: 4,
  SOKOL: 77,
  XDAI: 100,
} as const

export const networkNames = {
  1: 'MAINNET',
  4: 'RINKEBY',
  77: 'SOKOL',
  100: 'XDAI',
} as const

type CPKAddresses = {
  masterCopyAddress: string
  proxyFactoryAddress: string
  multiSendAddress: string
  fallbackHandlerAddress: string
}

interface Network {
  label: string
  url: string
  alternativeUrls: { [key: string]: string }[]
  graphHttpUri: string
  graphWsUri: string
  klerosCurateGraphHttpUri: string
  klerosCurateGraphWsUri: string
  realitioTimeout: number
  earliestBlockToCheck: number
  omenTCRListId: number
  contracts: {
    realitio: string
    realitioScalarAdapter: string
    marketMakerFactory: string
    marketMakerFactoryV2: string
    conditionalTokens: string
    oracle: string
    klerosBadge: string
    klerosTokenView: string
    klerosTCR: string
    dxTCR: string
    omenVerifiedMarkets: string
  }
  cpk?: CPKAddresses
  relayProxyFactoryAddress?: string
  wrapToken: string
  targetSafeImplementation: string
  nativeAsset: Token
  defaultToken?: string
  blockExplorer: string
  blockExplorerURL: string
}

type KnownContracts = keyof Network['contracts']

interface KnownTokenData {
  symbol: string
  decimals: number
  addresses: {
    [K in NetworkId]?: string
  }
  order: number
  disabled?: boolean
  name?: string
}

export const pseudoNativeAssetAddress = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE'

export const networks: { [K in NetworkId]: Network } = {
  [networkIds.MAINNET]: {
    label: 'Mainnet',
    url: `https://mainnet.infura.io/v3/${INFURA_PROJECT_ID}`,
    alternativeUrls: [
      {
        rpcUrl: `https://mainnet.infura.io/v3/${INFURA_PROJECT_ID}`,
        name: 'Infura',
      },
      { rpcUrl: 'https://cloudflare-eth.com/', name: 'Cloudflare' },
    ],
    graphHttpUri: GRAPH_MAINNET_HTTP,
    graphWsUri: GRAPH_MAINNET_WS,
    klerosCurateGraphHttpUri: KLEROS_CURATE_GRAPH_MAINNET_HTTP,
    klerosCurateGraphWsUri: KLEROS_CURATE_GRAPH_MAINNET_WS,
    realitioTimeout: 86400,
    earliestBlockToCheck: EARLIEST_MAINNET_BLOCK_TO_CHECK,
    omenTCRListId: 3,
    contracts: {
      realitio: '0x325a2e0f3cca2ddbaebb4dfc38df8d19ca165b47',
      realitioScalarAdapter: '0xaa548EfBb0972e0c4b9551dcCfb6B787A1B90082',
      marketMakerFactory: '0x89023DEb1d9a9a62fF3A5ca8F23Be8d87A576220',
      marketMakerFactoryV2: '0x0000000000000000000000000000000000000000',
      conditionalTokens: '0xC59b0e4De5F1248C1140964E0fF287B192407E0C',
      oracle: '0x0e414d014a77971f4eaa22ab58e6d84d16ea838e',
      klerosBadge: '0xcb4aae35333193232421e86cd2e9b6c91f3b125f',
      klerosTokenView: '0xf9b9b5440340123b21bff1ddafe1ad6feb9d6e7f',
      klerosTCR: '0xebcf3bca271b26ae4b162ba560e243055af0e679',
      dxTCR: '0x93DB90445B76329e9ed96ECd74e76D8fbf2590d8',
      omenVerifiedMarkets: '0xb72103eE8819F2480c25d306eEAb7c3382fBA612',
    },
    cpk: {
      masterCopyAddress: '0x34CfAC646f301356fAa8B21e94227e3583Fe3F5F',
      proxyFactoryAddress: '0x0fB4340432e56c014fa96286de17222822a9281b',
      multiSendAddress: '0xc3BD4deCF75e9937aefb7a4CE6Ec8931dB4cfAF0',
      fallbackHandlerAddress: '0x40A930851BD2e590Bd5A5C981b436de25742E980',
    },
    wrapToken: 'weth',
    nativeAsset: {
      address: pseudoNativeAssetAddress,
      image: getImageUrl('0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2'),
      symbol: 'ETH',
      decimals: 18,
    },
    targetSafeImplementation: '0xCB2E9FA32603Cdc2740b82a9A67ED3e977C33416',
    defaultToken: 'dai',
    blockExplorer: 'etherscan',
    blockExplorerURL: 'https://etherscan.io',
  },
  [networkIds.RINKEBY]: {
    label: 'Rinkeby',
    url: `https://rinkeby.infura.io/v3/${INFURA_PROJECT_ID}`,
    alternativeUrls: [
      {
        rpcUrl: `https://rinkeby.infura.io/v3/${INFURA_PROJECT_ID}`,
        name: 'Infura',
      },
    ],
    graphHttpUri: GRAPH_RINKEBY_HTTP,
    graphWsUri: GRAPH_RINKEBY_WS,
    klerosCurateGraphHttpUri: KLEROS_CURATE_GRAPH_RINKEBY_HTTP,
    klerosCurateGraphWsUri: KLEROS_CURATE_GRAPH_RINKEBY_WS,
    realitioTimeout: 180,
    earliestBlockToCheck: EARLIEST_RINKEBY_BLOCK_TO_CHECK,
    omenTCRListId: 1,
    contracts: {
      realitio: '0x3D00D77ee771405628a4bA4913175EcC095538da',
      realitioScalarAdapter: '0x0e8Db8caD541C0Bf5b611636e81fEc0828bc7902',
      marketMakerFactory: '0x0fB4340432e56c014fa96286de17222822a9281b',
      marketMakerFactoryV2: '0x9dd6eB146D7fb98614487617DE608560321E15BE',
      conditionalTokens: '0x36bede640D19981A82090519bC1626249984c908',
      oracle: '0x17174dC1b62add32a1DE477A357e75b0dcDEed6E',
      klerosBadge: '0x0000000000000000000000000000000000000000',
      klerosTokenView: '0x0000000000000000000000000000000000000000',
      klerosTCR: '0x0000000000000000000000000000000000000000',
      dxTCR: '0x03165DF66d9448E45c2f5137486af3E7e752a352',
      omenVerifiedMarkets: '0x3b29096b7ab49428923d902cEC3dFEaa49993234',
    },
    cpk: {
      masterCopyAddress: '0x34CfAC646f301356fAa8B21e94227e3583Fe3F5F',
      proxyFactoryAddress: '0x336c19296d3989e9e0c2561ef21c964068657c38',
      multiSendAddress: '0x82CFd05a033e202E980Bc99eA50A4C6BB91CE0d7',
      fallbackHandlerAddress: '0x40A930851BD2e590Bd5A5C981b436de25742E980',
    },
    wrapToken: 'weth',
    nativeAsset: {
      address: pseudoNativeAssetAddress,
      image: getImageUrl('0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2'),
      symbol: 'ETH',
      decimals: 18,
    },
    targetSafeImplementation: '0xcb05C7D28766e4fFB71ccbdAf6Ae1Cec555D61f8',
    defaultToken: 'dai',
    blockExplorer: 'etherscan',
    blockExplorerURL: 'https://rinkeby.etherscan.io',
  },
  [networkIds.SOKOL]: {
    label: 'Sokol',
    url: 'https://sokol.poa.network',
    alternativeUrls: [
      {
        rpcUrl: 'https://sokol.poa.network',
        name: 'xDai',
      },
    ],
    graphHttpUri: GRAPH_SOKOL_HTTP,
    graphWsUri: GRAPH_SOKOL_WS,
    klerosCurateGraphHttpUri: KLEROS_CURATE_GRAPH_RINKEBY_HTTP,
    klerosCurateGraphWsUri: KLEROS_CURATE_GRAPH_RINKEBY_WS,
    realitioTimeout: 180,
    earliestBlockToCheck: EARLIEST_RINKEBY_BLOCK_TO_CHECK,
    omenTCRListId: 0,
    contracts: {
      realitio: '0x90a617ed516ab7fAaBA56CcEDA0C5D952f294d03',
      realitioScalarAdapter: '0x1D369EEC97cF2E62c8DBB804b3998Bf15bcb67dB',
      marketMakerFactory: '0x2fb8cc057946DCFA32D8eA8115A1Dd630f6efea5',
      marketMakerFactoryV2: '0x0000000000000000000000000000000000000000',
      conditionalTokens: '0x0Db8C35045a830DC7F2A4dd87ef90e7A9Cd0534f',
      oracle: '0x9E6bd63aEbFb2E858B6111cea9C389f7664F7108',
      klerosBadge: '0x0000000000000000000000000000000000000000',
      klerosTokenView: '0x0000000000000000000000000000000000000000',
      klerosTCR: '0x0000000000000000000000000000000000000000',
      dxTCR: '0x5486a9050f2aC6f535a72526e37738A060508361',
      omenVerifiedMarkets: '0x0000000000000000000000000000000000000000',
    },
    cpk: {
      masterCopyAddress: '0x035000FC773f4a0e39FcdeD08A46aBBDBF196fd3',
      proxyFactoryAddress: '0xaaF0CCef0C0C355Ee764B3d36bcCF257C527269B',
      multiSendAddress: '0xBe95a1C930B7d4F816518Ad7742062537F928b99',
      fallbackHandlerAddress: '0x1e9C3EBAd833b26E522D2fDa180Af3D2A32459D2',
    },
    wrapToken: 'wspoa',
    nativeAsset: {
      address: pseudoNativeAssetAddress,
      image: getImageUrl('0x6b175474e89094c44da98b954eedeac495271d0f'),
      symbol: 'SPOA',
      decimals: 18,
    },
    targetSafeImplementation: '0x035000FC773f4a0e39FcdeD08A46aBBDBF196fd3',
    blockExplorer: 'blockscout',
    blockExplorerURL: 'https://blockscout.com/poa/sokol',
  },
  [networkIds.XDAI]: {
    label: 'xDai',
    url: 'https://rpc.xdaichain.com/',
    alternativeUrls: [
      {
        rpcUrl: 'https://rpc.xdaichain.com/',
        name: 'xDai',
      },
      {
        rpcUrl: 'https://dai.poa.network/',
        name: 'Blockscout',
      },
    ],
    graphHttpUri: GRAPH_XDAI_HTTP,
    graphWsUri: GRAPH_XDAI_WS,
    klerosCurateGraphHttpUri: KLEROS_CURATE_GRAPH_RINKEBY_HTTP,
    klerosCurateGraphWsUri: KLEROS_CURATE_GRAPH_RINKEBY_WS,
    realitioTimeout: 86400,
    earliestBlockToCheck: EARLIEST_RINKEBY_BLOCK_TO_CHECK,
    omenTCRListId: 2,
    contracts: {
      realitio: '0x79e32aE03fb27B07C89c0c568F80287C01ca2E57',
      realitioScalarAdapter: '0xcA75aaC320089c9fb077E86857fF6e954Df06a6B',
      marketMakerFactory: '0x9083A2B699c0a4AD06F63580BDE2635d26a3eeF0',
      marketMakerFactoryV2: '0x0000000000000000000000000000000000000000',
      conditionalTokens: '0xCeAfDD6bc0bEF976fdCd1112955828E00543c0Ce',
      oracle: '0xAB16D643bA051C11962DA645f74632d3130c81E2',
      klerosBadge: '0x0000000000000000000000000000000000000000',
      klerosTokenView: '0x0000000000000000000000000000000000000000',
      klerosTCR: '0x0000000000000000000000000000000000000000',
      dxTCR: '0x85E001DfFF16F388Bc32Cd18009ceDF8F9b62C9E',
      omenVerifiedMarkets: '0x0000000000000000000000000000000000000000',
    },
    cpk: {
      masterCopyAddress: '0x6851D6fDFAfD08c0295C392436245E5bc78B0185',
      proxyFactoryAddress: '0x3049b84bbC3EB2C375547CAc0D77da032d3d1981',
      multiSendAddress: '0x035000FC773f4a0e39FcdeD08A46aBBDBF196fd3',
      fallbackHandlerAddress: '0x602DF5F404f86469459D5e604CDa43A2cdFb7580',
    },
    relayProxyFactoryAddress: '0x7b9756f8A7f4208fE42FE8DE8a8CC5aA9A03f356',
    wrapToken: 'wxdai',
    nativeAsset: {
      address: pseudoNativeAssetAddress,
      image: getImageUrl('0x6b175474e89094c44da98b954eedeac495271d0f'),
      symbol: 'xDAI',
      decimals: 18,
    },
    targetSafeImplementation: '0x9C75A217AEA76663a9A37687606f099945eb0742',
    blockExplorer: 'blockscout',
    blockExplorerURL: 'https://blockscout.com/poa/xdai',
  },
}

export const getChainSpecificAlternativeUrls = (networkId: any) => {
  if (!validNetworkId(networkId)) {
    return false
  }

  return networks[networkId].alternativeUrls
}
if (localStorage.getItem('rpcAddress')) {
  const data = JSON.parse(<string>localStorage.getItem('rpcAddress'))
  const network: NetworkId = data.network
  networks[network].url = data.url
}

export const supportedNetworkIds = Object.keys(networks).map(Number) as NetworkId[]

export const supportedNetworkURLs = entries(networks).reduce<{
  [networkId: number]: string
}>(
  (acc, [networkId, network]) => ({
    ...acc,
    [networkId]: network.url,
  }),
  {},
)

export const getInfuraUrl = (networkId: number): string => {
  if (!validNetworkId(networkId)) {
    throw new Error(`Unsupported network id: '${networkId}'`)
  }
  return networks[networkId].url
}

export const knownTokens: { [name in KnownToken]: KnownTokenData } = {
  cdai: {
    symbol: 'cDAI',
    decimals: 8,
    addresses: {
      [networkIds.MAINNET]: '0x5d3a536E4D6DbD6114cc1Ead35777bAB948E3643',
      [networkIds.RINKEBY]: '0x6d7f0754ffeb405d23c51ce938289d4835be3b14',
    },
    order: 2,
  },
  omn: {
    symbol: 'OMN',
    name: 'Omen',
    decimals: 18,
    addresses: {
      // [networkIds.MAINNET]: '0x543ff227f64aa17ea132bf9886cab5db55dcaddf',
      //[networkIds.XDAI]: '0x12daBe79cffC1fdE82FCd3B96DBE09FA4D8cd599',
      [networkIds.RINKEBY]: '0x0A08ECa47C56C305F4FeB4fa062AEcd5807BeBb8',
    },
    order: 22,
  },
  stake: {
    symbol: 'STAKE',
    decimals: 18,
    addresses: {
      [networkIds.MAINNET]: '0x0Ae055097C6d159879521C384F1D2123D1f195e6',
      [networkIds.XDAI]: '0xb7D311E2Eb55F2f68a9440da38e7989210b9A05e',
    },
    order: 22,
  },
  cbat: {
    symbol: 'cBAT',
    decimals: 8,
    addresses: {
      [networkIds.MAINNET]: '0x6c8c6b02e7b2be14d4fa6022dfd6d75921d90e4e',
      [networkIds.RINKEBY]: '0xebf1a11532b93a529b5bc942b4baa98647913002',
    },
    order: 10,
  },
  ceth: {
    symbol: 'cETH',
    decimals: 8,
    addresses: {
      [networkIds.MAINNET]: '0x4ddc2d193948926d02f9b1fe9e1daa0718270ed5',
      [networkIds.RINKEBY]: '0xd6801a1dffcd0a410336ef88def4320d6df1883e',
    },
    order: 11,
  },
  cusdc: {
    symbol: 'cUSDC',
    decimals: 8,
    addresses: {
      [networkIds.MAINNET]: '0x39aa39c021dfbae8fac545936693ac917d5e7563',
      [networkIds.RINKEBY]: '0x5b281a6dda0b271e91ae35de655ad301c976edb1',
    },
    order: 12,
  },
  cusdt: {
    symbol: 'cUSDT',
    decimals: 8,
    addresses: {
      [networkIds.MAINNET]: '0xf650c3d88d12db855b8bf7d11be6c55a4e07dcc9',
      [networkIds.RINKEBY]: '0x2fb298bdbef468638ad6653ff8376575ea41e768',
    },
    order: 13,
  },
  cwbtc: {
    symbol: 'cWBTC',
    decimals: 8,
    addresses: {
      [networkIds.MAINNET]: '0xc11b1268c1a384e55c48c2391d8d480264a3a7f4',
      [networkIds.RINKEBY]: '0x0014f450b8ae7708593f4a46f8fa6e5d50620f96',
    },
    order: 14,
  },
  cuni: {
    symbol: 'cUNI',
    decimals: 8,
    addresses: {
      [networkIds.MAINNET]: '0x35a18000230da775cac24873d00ff85bccded550',
    },
    order: 15,
  },
  wbtc: {
    symbol: 'WBTC',
    name: 'Wrapped Bitcoin',
    decimals: 8,
    addresses: {
      [networkIds.MAINNET]: '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599',
      [networkIds.RINKEBY]: '0x577d296678535e4903d59a4c929b718e1d575e0a',
      [networkIds.XDAI]: '0x8e5bBbb09Ed1ebdE8674Cda39A0c169401db4252',
    },
    order: 14,
  },
  dai: {
    symbol: 'DAI',
    name: 'Dai',
    decimals: 18,
    addresses: {
      [networkIds.MAINNET]: '0x6b175474e89094c44da98b954eedeac495271d0f',
      [networkIds.RINKEBY]: '0x5592ec0cfb4dbc12d3ab100b257153436a1f0fea',
    },
    order: 1,
  },
  wspoa: {
    symbol: 'WSPOA',
    decimals: 18,
    addresses: {
      [networkIds.SOKOL]: '0xc655c6d80ac92d75fbf4f40e95280aeb855b1e87',
    },
    order: 1,
  },
  wxdai: {
    symbol: 'wxDAI',
    decimals: 18,
    addresses: {
      [networkIds.XDAI]: '0xe91d153e0b41518a2ce8dd3d7944fa863463a97d',
    },
    order: 1,
  },
  weth: {
    symbol: 'WETH',
    name: 'Wrapped Ether',
    decimals: 18,
    addresses: {
      [networkIds.MAINNET]: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
      [networkIds.RINKEBY]: '0xc778417e063141139fce010982780140aa0cd5ab',
      [networkIds.XDAI]: '0x6A023CCd1ff6F2045C3309768eAd9E68F978f6e1',
    },
    order: 3,
  },
  usdc: {
    symbol: 'USDC',
    name: 'USD Coin',
    decimals: 6,
    addresses: {
      [networkIds.MAINNET]: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
      [networkIds.RINKEBY]: '0x4DBCdF9B62e891a7cec5A2568C3F4FAF9E8Abe2b',
      // [networkIds.XDAI]: '0xDDAfbb505ad214D7b80b1f830fcCc89B60fb7A83',
    },
    order: 4,
  },
  owl: {
    symbol: 'OWL',
    decimals: 18,
    addresses: {
      [networkIds.MAINNET]: '0x1a5f9352af8af974bfc03399e3767df6370d82e4',
      [networkIds.RINKEBY]: '0x9187a7788410f54a630407fa994c1555722f9abc',
    },
    order: 5,
  },
  chai: {
    symbol: 'CHAI',
    decimals: 18,
    addresses: {
      [networkIds.MAINNET]: '0x06AF07097C9Eeb7fD685c692751D5C66dB49c215',
    },
    order: 6,
  },
  gno: {
    symbol: 'GNO',
    decimals: 18,
    addresses: {
      [networkIds.MAINNET]: '0x6810e776880c02933d47db1b9fc05908e5386b96',
      [networkIds.RINKEBY]: '0x3e6e3f3266b1c3d814f9d237e7d144e563292112',
    },
    order: 7,
  },
  pnk: {
    symbol: 'PNK',
    decimals: 18,
    addresses: {
      [networkIds.MAINNET]: '0x93ed3fbe21207ec2e8f2d3c3de6e058cb73bc04d',
    },
    order: 8,
  },
  dxd: {
    symbol: 'DXD',
    decimals: 18,
    addresses: {
      [networkIds.MAINNET]: '0xa1d65E8fB6e87b60FECCBc582F7f97804B725521',
    },
    order: 9,
  },
}
//when adding new bridge currency ensure that it's present in known tokens and that it has both mainnet and xDai address added
export const bridgeTokensList: KnownToken[] = ['dai', 'weth', 'wbtc']

const validNetworkId = (networkId: number): networkId is NetworkId => {
  return networks[networkId as NetworkId] !== undefined
}

export const getContractAddress = (networkId: number, contract: KnownContracts) => {
  if (!validNetworkId(networkId)) {
    throw new Error(`Unsupported network id: '${networkId}'`)
  }
  return networks[networkId].contracts[contract]
}

export const getToken = (networkId: number, tokenId: KnownToken): Token => {
  if (!validNetworkId(networkId)) {
    throw new Error(`Unsupported network id: '${networkId}'`)
  }

  const token = knownTokens[tokenId]
  if (!token) {
    throw new Error(`Unsupported token id: '${tokenId}'`)
  }

  const address = token.addresses[networkId]

  if (!address) {
    throw new Error(`Unsupported address in network: '${networkId}'`)
  }

  return {
    address,
    decimals: token.decimals,
    symbol: token.symbol,
    name: token.name ? token.name : '',
    image: getImageUrl(address),
  }
}

export const getTokenFromAddress = (networkId: number, address: string): Token => {
  if (!validNetworkId(networkId)) {
    throw new Error(`Unsupported network id: '${networkId}'`)
  }

  for (const token of Object.values(knownTokens)) {
    const tokenAddress = token.addresses[networkId]

    // token might not be supported in the current network
    if (!tokenAddress) {
      continue
    }

    if (tokenAddress.toLowerCase() === address.toLowerCase()) {
      return {
        address: tokenAddress,
        decimals: token.decimals,
        symbol: token.symbol,
      }
    }
  }

  throw new Error(`Couldn't find token with address '${address}' in network '${networkId}'`)
}

export const getContractAddressName = (networkId: number) => {
  const networkName = Object.keys(networkIds).find(key => (networkIds as any)[key] === networkId)
  const networkNameCase = networkName && networkName.substr(0, 1).toUpperCase() + networkName.substr(1).toLowerCase()
  return networkNameCase
}

export const getDefaultToken = (networkId: number, relay = false) => {
  if (!validNetworkId(networkId)) {
    throw new Error(`Unsupported network id: '${networkId}'`)
  }

  const defaultToken = networks[networkId].defaultToken as KnownToken
  if (defaultToken) {
    return getToken(networkId, defaultToken)
  }

  return getNativeAsset(networkId, relay)
}

export const getTokensByNetwork = (networkId: number): Token[] => {
  if (!validNetworkId(networkId)) {
    throw new Error(`Unsupported network id: '${networkId}'`)
  }

  const wrapTokenAddress = getWrapToken(networkId).address
  const nativeAsset = getNativeAsset(networkId)

  return Object.values(knownTokens)
    .sort((a, b) => (a.order > b.order ? 1 : -1))
    .map(token => {
      const address = token.addresses[networkId]
      if (address) {
        return {
          symbol: token.symbol,
          decimals: token.decimals,
          image: address === wrapTokenAddress ? nativeAsset.image : getImageUrl(address),
          address,
        }
      }
      return null
    })
    .filter(isNotNull)
}

interface KnownArbitratorData {
  name: string
  url: string
  addresses: {
    [networkId: number]: string
  }
  isSelectionEnabled: boolean
}

export const knownArbitrators: { [name in KnownArbitrator]: KnownArbitratorData } = {
  kleros: {
    name: 'Kleros',
    url: 'https://kleros.io/',
    addresses: {
      [networkIds.MAINNET]: '0xd47f72a2d1d0E91b0Ec5e5f5d02B2dc26d00A14D',
      [networkIds.RINKEBY]: '0xcafa054b1b054581faf65adce667bf1c684b6ef0',
      [networkIds.SOKOL]: '0x37Fcdb26F12f3FC76F2424EC6B94D434a959A0f7',
      [networkIds.XDAI]: '0xe40DD83a262da3f56976038F1554Fe541Fa75ecd',
    },
    isSelectionEnabled: true,
  },
  dxdao: {
    name: 'DXdao',
    url: 'https://dxdao.eth.link/',
    addresses: {
      [networkIds.XDAI]: '0xFe14059344b74043Af518d12931600C0f52dF7c5',
    },
    isSelectionEnabled: true,
  },
  unknown: {
    name: 'Unknown',
    url: '',
    addresses: {},
    isSelectionEnabled: true,
  },
}

export const getArbitrator = (networkId: number, arbitratorId: KnownArbitrator): Arbitrator => {
  const arbitrator = knownArbitrators[arbitratorId]
  const address = arbitrator.addresses[networkId]

  if (!address) {
    throw new Error(`Unsupported network id: '${networkId}'`)
  }

  return {
    id: arbitratorId,
    address,
    name: arbitrator.name,
    url: arbitrator.url,
    isSelectionEnabled: arbitrator.isSelectionEnabled,
  }
}

export const getDefaultArbitrator = (networkId: number): Arbitrator => {
  if (!validNetworkId(networkId)) {
    throw new Error(`Unsupported network id: '${networkId}'`)
  }

  return getArbitrator(networkId, DEFAULT_ARBITRATOR)
}

export const getArbitratorFromAddress = (networkId: number, address: string): Arbitrator => {
  for (const key in knownArbitrators) {
    const arbitrator = knownArbitrators[key as KnownArbitrator]
    const arbitratorAddress = arbitrator.addresses[networkId]

    // arbitratorId might not be supported in the current network
    if (!arbitratorAddress) {
      continue
    }

    if (arbitratorAddress.toLowerCase() === address.toLowerCase()) {
      return {
        id: key as KnownArbitrator,
        address: arbitratorAddress,
        name: arbitrator.name,
        url: arbitrator.url,
        isSelectionEnabled: arbitrator.isSelectionEnabled,
      }
    }
  }

  return {
    id: 'unknown' as KnownArbitrator,
    address: address,
    name: 'Unknown',
    url: '',
    isSelectionEnabled: false,
  }
}

export const getKnowArbitratorFromAddress = (networkId: number, address: string): KnownArbitrator => {
  for (const key in knownArbitrators) {
    const arbitratorAddress = knownArbitrators[key as KnownArbitrator].addresses[networkId]

    if (!arbitratorAddress) {
      continue
    }

    if (arbitratorAddress.toLowerCase() === address.toLowerCase()) {
      return key as KnownArbitrator
    }
  }

  return 'unknown' as KnownArbitrator
}

export const getRealitioTimeout = (networkId: number): number => {
  if (!validNetworkId(networkId)) {
    throw new Error(`Unsupported network id: '${networkId}'`)
  }

  return networks[networkId].realitioTimeout
}

export const getEarliestBlockToCheck = (networkId: number): number => {
  if (!validNetworkId(networkId)) {
    throw new Error(`Unsupported network id: '${networkId}'`)
  }

  return networks[networkId].earliestBlockToCheck
}

export const getArbitratorsByNetwork = (networkId: number): Arbitrator[] => {
  if (!validNetworkId(networkId)) {
    throw new Error(`Unsupported network id: '${networkId}'`)
  }

  return Object.values(knownArbitrators)
    .map(arbitrator => {
      const address = arbitrator.addresses[networkId]
      if (address) {
        const { isSelectionEnabled, name, url } = arbitrator
        const id = getKnowArbitratorFromAddress(networkId, address)

        return {
          id,
          name,
          url,
          address,
          isSelectionEnabled,
        }
      }
      return null
    })
    .filter(isNotNull)
}

export const getCPKAddresses = (networkId: number): Maybe<CPKAddresses> => {
  if (!validNetworkId(networkId)) {
    throw new Error(`Unsupported network id: '${networkId}'`)
  }

  const cpkAddresses = networks[networkId].cpk
  return cpkAddresses || null
}

export const getRelayProxyFactory = (networkId: number): Maybe<string> => {
  if (!validNetworkId(networkId)) {
    throw new Error(`Unsupported network id: '${networkId}'`)
  }

  const proxyFactoryAddress = networks[networkId].relayProxyFactoryAddress
  return proxyFactoryAddress || null
}

export const getGraphUris = (networkId: number): { httpUri: string; wsUri: string } => {
  if (!validNetworkId(networkId)) {
    throw new Error(`Unsupported network id: '${networkId}'`)
  }

  const httpUri = networks[networkId].graphHttpUri
  const wsUri = networks[networkId].graphWsUri
  return { httpUri, wsUri }
}

export const getKlerosCurateGraphUris = (networkId: number): { httpUri: string; wsUri: string } => {
  if (!validNetworkId(networkId)) {
    throw new Error(`Unsupported network id: '${networkId}'`)
  }

  const httpUri = networks[networkId].klerosCurateGraphHttpUri
  const wsUri = networks[networkId].klerosCurateGraphWsUri
  return { httpUri, wsUri }
}

export const getOutcomes = (networkId: number, templateId: number) => {
  const isBinary = templateId === 0
  const isNuancedBinary = (networkId === 1 && templateId === 6) || (networkId === 4 && templateId === 5)
  const isScalar = templateId === 1
  if (isBinary || isNuancedBinary) {
    return ['No', 'Yes']
  } else if (isScalar) {
    return []
  } else {
    throw new Error(`Cannot get outcomes for network '${networkId}' and template id '${templateId}'`)
  }
}

export const getOmenTCRListId = (networkId: number): number => {
  if (!validNetworkId(networkId)) {
    throw new Error(`Unsupported network id: '${networkId}'`)
  }

  return networks[networkId].omenTCRListId
}

export const getWrapToken = (networkId: number): Token => {
  if (!validNetworkId(networkId)) {
    throw new Error(`Unsupported network id: '${networkId}'`)
  }
  const tokenId = networks[networkId].wrapToken as KnownToken
  return getToken(networkId, tokenId)
}

export const getNativeAsset = (networkId: number, relay = false): Token => {
  if (!validNetworkId(networkId)) {
    throw new Error(`Unsupported network id: '${networkId}'`)
  }
  const asset = networks[networkId].nativeAsset as Token
  if (relay) {
    const symbol = asset.symbol.replace('x', '')
    return { ...asset, symbol }
  }
  return asset
}

export const getNativeCompoundAsset = (networkId: number): Token => {
  if (!validNetworkId(networkId)) {
    throw new Error(`Unsupported network id: '${networkId}'`)
  } else {
    const knownToken = 'ceth' as KnownToken
    return getToken(networkId, knownToken)
  }
}

export const getTargetSafeImplementation = (networkId: number): string => {
  if (!validNetworkId(networkId)) {
    throw new Error(`Unsupported network id: '${networkId}'`)
  }
  return networks[networkId].targetSafeImplementation.toLowerCase()
}

export const getGraphMeta = async (networkId: number) => {
  const query = `
    query {
      _meta {
        block {
          hash
          number
        }
      }
    }
  `
  const { httpUri } = getGraphUris(networkId)
  const result = await axios.post(httpUri, { query })
  return result.data.data._meta.block
}

export const waitForBlockToSync = async (networkId: number, blockNum: number) => {
  let block
  while (!block || block.number < blockNum + 1) {
    block = await getGraphMeta(networkId)
    await waitABit()
  }
}

export const getBySafeTx = async (networkId: number, safeTxHash: string) => {
  const networkName = (networkNames as any)[networkId].toLowerCase()
  const txServiceUrl = `https://safe-transaction.${networkName}.gnosis.io/api/v1`
  const result = await axios.get(`${txServiceUrl}/transactions/${safeTxHash}`)
  return result.data
}

export const getBlockExplorer = (networkId: number): string => {
  if (!validNetworkId(networkId)) {
    throw new Error(`Unsupported network id: '${networkId}'`)
  }
  return networks[networkId].blockExplorer
}

export const getTxHashBlockExplorerURL = (networkId: number, txHash: string): string => {
  if (!validNetworkId(networkId)) {
    throw new Error(`Unsupported network id: '${networkId}'`)
  }
  return `${networks[networkId].blockExplorerURL}/tx/${txHash}`
}

export const getAddressBlockExplorerURL = (networkId: number, contractAddress: string): string => {
  if (!validNetworkId(networkId)) {
    throw new Error(`Unsupported network id: '${networkId}'`)
  }
  return `${networks[networkId].blockExplorerURL}/address/${contractAddress}`
}
