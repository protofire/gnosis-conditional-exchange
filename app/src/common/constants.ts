import { OmenLogo } from '../components/common/logos/omen'

export const LOGGER_ID = 'gnosis-conditional-exchange'
export const THREEBOX_ADMIN_ADDRESS = '0x90F8bf6A479f320ead074411a4B0e7944Ea8c9C1'
export const THREEBOX_SPACE_NAME = 'conditional_exchange'
export const INFURA_PROJECT_ID = '9c6788bb15234036991db4637638429f'
export const REALITIO_TIMEOUT = 86400
export const EARLIEST_MAINNET_BLOCK_TO_CHECK = parseInt('9294139')
export const EARLIEST_RINKEBY_BLOCK_TO_CHECK = parseInt('6127043')
export const FETCH_EVENTS_CHUNK_SIZE = parseInt('500000', 10)

const MAX_OUTCOMES = parseInt('8', 10)
export const MAX_OUTCOME_ALLOWED = MAX_OUTCOMES > 256 ? 256 : MAX_OUTCOMES
export const CONFIRMATION_COUNT = 9

export const UINT_TEMPLATE_ID = 1
export const SINGLE_SELECT_TEMPLATE_ID = 2

export const MARKET_FEE = parseFloat('2.00')
export const MAX_MARKET_FEE = parseFloat('5.00')

export const CATEGORIES = [
  'Business & Finance',
  'Cryptocurrency',
  'News & Politics',
  'Science & Tech',
  'Sports',
  'Weather',
  'Miscellaneous',
]

export const TRADING_FEE_OPTIONS = [
  '0.00',
  '0.25',
  '0.50',
  '0.75',
  '1.00',
  '1.25',
  '1.50',
  '1.75',
  '2.00',
  '2.25',
  '2.50',
  '2.75',
  '3.00',
  '3.25',
  '3.50',
  '3.75',
  '4.00',
  '4.25',
  '4.50',
  '4.75',
  '5.00',
]

export const GRAPH_MAINNET_HTTP = 'https://api.thegraph.com/subgraphs/name/protofire/omen'
export const GRAPH_MAINNET_WS = 'wss://api.thegraph.com/subgraphs/name/protofire/omen'
export const GRAPH_RINKEBY_HTTP = 'https://api.thegraph.com/subgraphs/name/kadenzipfel/omen-rinkeby' // TODO: change back 'https://api.thegraph.com/subgraphs/name/protofire/omen-rinkeby'
export const GRAPH_RINKEBY_WS = 'wss://api.thegraph.com/subgraphs/name/protofire/omen-rinkeby'
export const GRAPH_SOKOL_HTTP = 'https://api.thegraph.com/subgraphs/name/protofire/omen-sokol'
export const GRAPH_SOKOL_WS = 'wss://api.thegraph.com/subgraphs/name/protofire/omen-sokol'
export const GRAPH_XDAI_HTTP = 'https://api.thegraph.com/subgraphs/name/protofire/omen-xdai'
export const GRAPH_XDAI_WS = 'wss://api.thegraph.com/subgraphs/name/protofire/omen-xdai'

export const KLEROS_CURATE_GRAPH_MAINNET_HTTP = 'https://api.thegraph.com/subgraphs/name/kleros/curate'
export const KLEROS_CURATE_GRAPH_MAINNET_WS = 'wss://api.thegraph.com/subgraphs/name/kleros/curate'
export const KLEROS_CURATE_GRAPH_RINKEBY_HTTP = 'https://api.thegraph.com/subgraphs/name/kleros/curate-rinkeby'
export const KLEROS_CURATE_GRAPH_RINKEBY_WS = 'wss://api.thegraph.com/subgraphs/name/kleros/curate-rinkeby'

//xDai transaction data subgraphs
export const XDAI_HOME_BRIDGE = 'https://api.thegraph.com/subgraphs/name/maxaleks/home-bridge-xdai'
export const XDAI_FOREIGN_BRIDGE = 'https://api.thegraph.com/subgraphs/name/maxaleks/foreign-bridge-mainnet'
export const OMNI_HOME_BRIDGE = 'https://api.thegraph.com/subgraphs/name/raid-guild/xdai-omnibridge'
export const OMNI_FOREIGN_BRIDGE = 'https://api.thegraph.com/subgraphs/name/raid-guild/mainnet-omnibridge'

export const IPFS_GATEWAY = 'https://ipfs.kleros.io'

export const Logo = OmenLogo

export const DEFAULT_ARBITRATOR: KnownArbitrator = 'kleros'

export const DEFAULT_TOKEN = 'dai'

export const DOCUMENT_TITLE = 'Omen'
export const DOCUMENT_DESCRIPTION = 'Omen Information Markets'

export const DOCUMENT_VALIDITY_RULES = './rules.pdf'
export const DOCUMENT_FAQ = './faq.pdf'

export const OG_TITLE = 'Omen Prediction Markets'
export const OG_DESCRIPTION = 'Omen Information Markets'
export const OG_IMAGE = 'omen_logo_thumbnail.png'
export const OG_URL = 'https://omen.eth.link/'
export const OG_SITE_NAME = 'Omen'

export const TWITTER_CARD = 'summary_large_image'
export const TWITTER_IMAGE_ALT = 'Omen'
export const TWITTER_SITE = '@Omen_eth'

export const DISCLAIMER_TEXT = ''

export const FETCH_DETAILS_INTERVAL = parseInt('15000', 10)
export const SHOW_FOOTER = true
export const IMPORT_QUESTION_ID_KEY = 'importQuestionId'

export const DEFAULT_TOKEN_ADDRESS_RINKEBY = '0x5592ec0cfb4dbc12d3ab100b257153436a1f0fea'
export const DEFAULT_TOKEN_ADDRESS = '0x6b175474e89094c44da98b954eedeac495271d0f'
export const GEN_TOKEN_ADDDRESS_TESTING = '0x543ff227f64aa17ea132bf9886cab5db55dcaddf'
export const GEN_XDAI_ADDRESS_TESTING = '0x12daBe79cffC1fdE82FCd3B96DBE09FA4D8cd599'

export const MAIN_NETWORKS = ['1', '0x1', '4', '0x4']
export const XDAI_NETWORKS = ['100', '0x64', '77', '0x4d']
export const RINKEBY_NETWORKS = ['4', '0x4']
export const SOKOL_NETWORKS = ['77', '0x4d']

export const XDAI_TO_DAI_TOKEN_BRIDGE_ADDRESS = '0x7301CFA0e1756B71869E93d4e4Dca5c7d0eb0AA6'
export const DAI_TO_XDAI_TOKEN_BRIDGE_ADDRESS = '0x4aa42145Aa6Ebf72e164C9bBC74fbD3788045016'
export const OMNI_BRIDGE_MAINNET_ADDRESS = '0x88ad09518695c6c3712AC10a214bE5109a655671'
export const OMNI_BRIDGE_XDAI_ADDRESS = '0xf6A78083ca3e2a662D6dd1703c939c8aCE2e268d'

export const OMNI_CLAIM_ADDRESS = '0x4C36d2919e407f0Cc2Ee3c993ccF8ac26d9CE64e'
export const OMNI_BRIDGE_VALIDATORS = '0x75Df5AF045d91108662D8080fD1FEFAd6aA0bb59'

export const MULTI_CLAIM_ADDRESS = '0x5699D0D42bc1a0501D7DC270fD800Af6654Ace3E'

export const RELAY_FEE = '1000000000000000' // 0.001 xdai
export const RELAY_ADDRESS = '0x1B50BC65403333F921fE627eda28C119a93AA15F'

export const STANDARD_DECIMALS = 18
export const YEAR_IN_SECONDS = 31536000
