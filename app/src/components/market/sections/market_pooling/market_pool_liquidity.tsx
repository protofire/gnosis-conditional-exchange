import { Zero } from 'ethers/constants'
import { BigNumber, bigNumberify } from 'ethers/utils'
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { RouteComponentProps, useHistory, withRouter } from 'react-router-dom'
import styled from 'styled-components'

import { DOCUMENT_FAQ, STANDARD_DECIMALS } from '../../../../common/constants'
import {
  useCollateralBalance,
  useCompoundService,
  useConnectedBalanceContext,
  useConnectedCPKContext,
  useConnectedWeb3Context,
  useContracts,
  useCpkAllowance,
  useCpkProxy,
  useFundingBalance,
  useSymbol,
} from '../../../../hooks'
import {
  GraphResponseLiquidityMiningCampaign,
  useGraphLiquidityMiningCampaigns,
} from '../../../../hooks/useGraphLiquidityMiningCampaigns'
import { StakingService } from '../../../../services/staking'
import { getLogger } from '../../../../util/logger'
import {
  getNativeAsset,
  getNativeCompoundAsset,
  getToken,
  getWrapToken,
  pseudoNativeAssetAddress,
} from '../../../../util/networks'
import { RemoteData } from '../../../../util/remote_data'
import {
  calcAddFundingSendAmounts,
  calcPoolTokens,
  calcRemoveFundingSendAmounts,
  formatBigNumber,
  formatNumber,
  getBaseTokenForCToken,
  getInitialCollateral,
  getSharesInBaseToken,
} from '../../../../util/tools'
import {
  CompoundTokenType,
  MarketDetailsTab,
  MarketMakerData,
  OutcomeTableValue,
  Ternary,
  Token,
  TransactionStep,
} from '../../../../util/types'
import { Button, ButtonContainer, ButtonTab } from '../../../button'
import { ButtonType } from '../../../button/button_styling_types'
import { BigNumberInput, TextfieldCustomPlaceholder } from '../../../common'
import { BigNumberInputReturn } from '../../../common/form/big_number_input'
import { IconOmen } from '../../../common/icons'
import { ModalTransactionWrapper } from '../../../modal'
import { CurrenciesWrapper, GenericError, TabsGrid } from '../../common/common_styled'
import { CurrencySelector } from '../../common/currency_selector'
import { GridTransactionDetails } from '../../common/grid_transaction_details'
import { OutcomeTable } from '../../common/outcome_table'
import { SetAllowance } from '../../common/set_allowance'
import { SwitchTransactionToken } from '../../common/switch_transaction_token'
import { TokenBalance } from '../../common/token_balance'
import { TransactionDetailsCard } from '../../common/transaction_details_card'
import { TransactionDetailsLine } from '../../common/transaction_details_line'
import { TransactionDetailsRow, ValueStates } from '../../common/transaction_details_row'
import { WarningMessage } from '../../common/warning_message'

import { UserPoolData } from './user_pool_data'

interface Props extends RouteComponentProps<any> {
  marketMakerData: MarketMakerData
  theme?: any
  switchMarketTab: (arg0: MarketDetailsTab) => void
  fetchGraphMarketMakerData: () => Promise<void>
}

enum Tabs {
  deposit,
  withdraw,
}

const BottomButtonWrapper = styled(ButtonContainer)`
  justify-content: space-between;
  margin: 0 -24px;
  padding: 20px 24px 0;
`

const BottomButtonRight = styled.div`
  display: flex;
  align-items: center;
`

const WarningMessageStyled = styled(WarningMessage)`
  margin-bottom: 0;
  margin-bottom: 24px;
`
const SetAllowanceStyled = styled(SetAllowance)`
  margin-bottom: 20px;
`

const logger = getLogger('Market::Fund')

const MarketPoolLiquidityWrapper: React.FC<Props> = (props: Props) => {
  const { fetchGraphMarketMakerData, marketMakerData } = props
  const { address: marketMakerAddress, balances, fee, totalEarnings, totalPoolShares, userEarnings } = marketMakerData
  const history = useHistory()
  const context = useConnectedWeb3Context()
  const { account, library: provider, networkId, relay } = context
  const cpk = useConnectedCPKContext()
  const { fetchBalances } = useConnectedBalanceContext()

  const { buildMarketMaker, conditionalTokens } = useContracts(context)
  const marketMaker = buildMarketMaker(marketMakerAddress)

  const signer = useMemo(() => provider.getSigner(), [provider])
  const [allowanceFinished, setAllowanceFinished] = useState(false)

  const wrapToken = getWrapToken(networkId)
  const nativeAsset = getNativeAsset(networkId, relay)
  const initialCollateral =
    marketMakerData.collateral.address.toLowerCase() === wrapToken.address.toLowerCase()
      ? nativeAsset
      : marketMakerData.collateral
  const [collateral, setCollateral] = useState<Token>(initialCollateral)

  const { compoundService: CompoundService } = useCompoundService(collateral, context)
  const compoundService = CompoundService || null

  const [amountToFund, setAmountToFund] = useState<Maybe<BigNumber>>(new BigNumber(0))
  const [amountToFundDisplay, setAmountToFundDisplay] = useState<string>('')
  const [isNegativeAmountToFund, setIsNegativeAmountToFund] = useState<boolean>(false)
  const [amountToRemove, setAmountToRemove] = useState<Maybe<BigNumber>>(new BigNumber(0))
  const [amountToRemoveDisplay, setAmountToRemoveDisplay] = useState<string>('')
  const [isNegativeAmountToRemove, setIsNegativeAmountToRemove] = useState<boolean>(false)
  const [message, setMessage] = useState<string>('')
  const [icon, setIcon] = useState<boolean>(false)
  const [displayCollateral, setDisplayCollateral] = useState<Token>(
    getInitialCollateral(context.networkId, collateral, relay),
  )
  const { allowance, unlock } = useCpkAllowance(signer, displayCollateral.address)
  let symbol = useSymbol(collateral)
  const collateralSymbol = collateral.symbol.toLowerCase()
  const [isTransactionProcessing, setIsTransactionProcessing] = useState<boolean>(false)
  const [amountToFundNormalized, setAmountToFundNormalized] = useState<Maybe<BigNumber>>(new BigNumber(0))
  const [amountToRemoveNormalized, setAmountToRemoveNormalized] = useState<Maybe<BigNumber>>(new BigNumber(0))
  const [isTransactionModalOpen, setIsTransactionModalOpen] = useState<boolean>(false)
  const [txState, setTxState] = useState<TransactionStep>(TransactionStep.idle)
  const [txHash, setTxHash] = useState('')
  const [rewardApr, setRewardApr] = useState(0)
  const [remainingRewards, setRemainingRewards] = useState(0)
  const [earnedRewards, setEarnedRewards] = useState(0)
  const [totalRewards, setTotalRewards] = useState(0)
  const [liquidityMiningCampaign, setLiquidityMiningCampaign] = useState<Maybe<GraphResponseLiquidityMiningCampaign>>()
  const [userStakedTokens, setUserStakedTokens] = useState(new BigNumber(0))

  const [upgradeFinished, setUpgradeFinished] = useState(false)
  const { proxyIsUpToDate, updateProxy } = useCpkProxy()
  const isUpdated = RemoteData.hasData(proxyIsUpToDate) ? proxyIsUpToDate.data : true

  let baseCollateral = collateral
  if (collateralSymbol in CompoundTokenType) {
    const nativeCompoundAsset = getNativeCompoundAsset(networkId)
    if (collateralSymbol === nativeCompoundAsset.symbol.toLowerCase()) {
      baseCollateral = getNativeAsset(networkId)
    } else {
      const baseCollateralSymbol = getBaseTokenForCToken(collateral.symbol.toLowerCase()) as KnownToken
      baseCollateral = getToken(networkId, baseCollateralSymbol)
    }
    symbol = baseCollateral.symbol
  }

  useEffect(() => {
    setIsNegativeAmountToFund(formatBigNumber(amountToFund || Zero, collateral.decimals).includes('-'))
  }, [amountToFund, collateral.decimals])

  useEffect(() => {
    setIsNegativeAmountToRemove(formatBigNumber(amountToRemove || Zero, collateral.decimals).includes('-'))
  }, [amountToRemove, collateral.decimals])

  useEffect(() => {
    setCollateral(initialCollateral)
    setAmountToFund(null)
    setAmountToFundDisplay('')
    setAmountToRemove(null)
    setAmountToRemoveDisplay('')
    // eslint-disable-next-line
  }, [marketMakerData.collateral.address])

  const resolutionDate = marketMakerData.question.resolution.getTime()
  const currentDate = new Date().getTime()
  const disableDepositTab = currentDate > resolutionDate
  const [activeTab, setActiveTab] = useState(disableDepositTab ? Tabs.withdraw : Tabs.deposit)

  let displayTotalSymbol = symbol
  if (activeTab === Tabs.withdraw) {
    if (collateral.address === pseudoNativeAssetAddress || collateralSymbol in CompoundTokenType) {
      displayTotalSymbol = displayCollateral.symbol
    }
  }

  const feeFormatted = useMemo(() => `${formatBigNumber(fee.mul(Math.pow(10, 2)), STANDARD_DECIMALS)}%`, [fee])

  const hasEnoughAllowance = RemoteData.mapToTernary(allowance, allowance => allowance.gte(amountToFund || Zero))
  const hasZeroAllowance = RemoteData.mapToTernary(allowance, allowance => allowance.isZero())

  const poolTokens = calcPoolTokens(
    amountToFund || Zero,
    balances.map(b => b.holdings),
    totalPoolShares,
  )

  const sendAmountsAfterAddingFunding = calcAddFundingSendAmounts(
    amountToFund || Zero,
    balances.map(b => b.holdings),
    totalPoolShares,
  )

  const sharesAfterAddingFunding = sendAmountsAfterAddingFunding
    ? balances.map((balance, i) => balance.shares.add(sendAmountsAfterAddingFunding[i]))
    : balances.map(balance => balance.shares)

  const sendAmountsAfterRemovingFunding = calcRemoveFundingSendAmounts(
    amountToRemove || Zero,
    balances.map(b => b.holdings),
    totalPoolShares,
  )
  const depositedTokens = sendAmountsAfterRemovingFunding.reduce((min: BigNumber, amount: BigNumber) =>
    amount.lt(min) ? amount : min,
  )

  const sharesAfterRemovingFunding = balances.map((balance, i) => {
    return balance.shares.add(sendAmountsAfterRemovingFunding[i]).sub(depositedTokens)
  })

  const showSharesChange = activeTab === Tabs.deposit ? amountToFund?.gt(0) : amountToRemove?.gt(0)

  const { collateralBalance: maybeCollateralBalance, fetchCollateralBalance } = useCollateralBalance(
    displayCollateral,
    context,
  )
  const collateralBalance = maybeCollateralBalance || Zero
  const probabilities = balances.map(balance => balance.probability)
  const showSetAllowance =
    displayCollateral.address !== pseudoNativeAssetAddress &&
    !cpk?.isSafeApp &&
    (allowanceFinished || hasZeroAllowance === Ternary.True || hasEnoughAllowance === Ternary.False)
  const depositedTokensTotal = depositedTokens.add(userEarnings)
  const { fetchFundingBalance, fundingBalance: maybeFundingBalance } = useFundingBalance(marketMakerAddress, context)
  const fundingBalance = maybeFundingBalance || Zero

  const walletBalance = formatNumber(formatBigNumber(collateralBalance, displayCollateral.decimals, 5), 5)
  const sharesBalance = formatBigNumber(fundingBalance, collateral.decimals)

  const totalUserShareAmounts = calcRemoveFundingSendAmounts(
    fundingBalance,
    balances.map(b => b.holdings),
    totalPoolShares,
  )

  const totalDepositedTokens = totalUserShareAmounts.reduce((min: BigNumber, amount: BigNumber) =>
    amount.lt(min) ? amount : min,
  )

  const totalUserLiquidity = totalDepositedTokens.add(userEarnings)

  const addFunding = async () => {
    try {
      if (!cpk) {
        return
      }
      if (!account) {
        throw new Error('Please connect to your wallet to perform this action.')
      }
      if (
        !cpk?.isSafeApp &&
        collateral.address !== pseudoNativeAssetAddress &&
        displayCollateral.address !== pseudoNativeAssetAddress &&
        hasEnoughAllowance !== Ternary.True
      ) {
        throw new Error("This method shouldn't be called if 'hasEnoughAllowance' is unknown or false")
      }
      let useBaseToken = false
      if (displayCollateral.address !== collateral.address && collateral.symbol.toLowerCase() in CompoundTokenType) {
        useBaseToken = true
      }
      let fundsAmount = formatBigNumber(amountToFund || Zero, collateral.decimals, collateral.decimals)
      if (collateralSymbol in CompoundTokenType && displayCollateral.symbol === baseCollateral.symbol) {
        fundsAmount = formatBigNumber(
          amountToFundNormalized || Zero,
          displayCollateral.decimals,
          displayCollateral.decimals,
        )
      }
      setMessage(`Depositing funds: ${formatNumber(fundsAmount)} ${displayCollateral.symbol}...`)

      setTxState(TransactionStep.waitingConfirmation)
      setIsTransactionProcessing(true)
      setIsTransactionModalOpen(true)
      await cpk.addFunding({
        amount: amountToFundNormalized || Zero,
        compoundService,
        collateral,
        marketMaker,
        setTxHash,
        setTxState,
        useBaseToken,
      })

      await fetchGraphMarketMakerData()
      await fetchFundingBalance()
      await fetchCollateralBalance()
      await fetchBalances()

      setAmountToFund(null)
      setAmountToFundDisplay('')
      setAmountToFundNormalized(null)
      setMessage(`Successfully deposited ${formatNumber(fundsAmount)} ${displayCollateral.symbol}`)
      setIsTransactionProcessing(false)
    } catch (err) {
      setTxState(TransactionStep.error)
      setMessage(`Error trying to deposit funds.`)
      logger.error(`${message} - ${err.message}`)
      setIsTransactionProcessing(false)
    }
  }

  const addFundingAndStake = async () => {
    try {
      if (!cpk) {
        return
      }
      if (!liquidityMiningCampaign) {
        throw new Error('No liquidity mining campaign')
      }
      if (!account) {
        throw new Error('Please connect to your wallet to perform this action.')
      }
      if (
        !cpk?.isSafeApp &&
        collateral.address !== pseudoNativeAssetAddress &&
        displayCollateral.address !== pseudoNativeAssetAddress &&
        hasEnoughAllowance !== Ternary.True
      ) {
        throw new Error("This method shouldn't be called if 'hasEnoughAllowance' is unknown or false")
      }

      setMessage(
        `Depositing funds: ${formatBigNumber(amountToFundNormalized || Zero, displayCollateral.decimals)} ${
          displayCollateral.symbol
        }...`,
      )

      setTxState(TransactionStep.waitingConfirmation)
      setIsTransactionProcessing(true)
      setIsTransactionModalOpen(true)

      await cpk.depositAndStake({
        amount: amountToFundNormalized || Zero,
        campaignAddress: liquidityMiningCampaign.id,
        collateral,
        compoundService,
        holdingsBN: balances.map(b => b.holdings),
        marketMaker,
        poolShareSupply: totalPoolShares,
        setTxHash,
        setTxState,
        useBaseToken: false, // Not using base token for staking
      })

      await fetchGraphMarketMakerData()
      await fetchFundingBalance()
      await fetchCollateralBalance()
      await fetchBalances()
      await fetchStakingData()

      setAmountToFund(null)
      setAmountToFundDisplay('')
      setAmountToFundNormalized(null)
      setMessage(
        `Successfully deposited ${formatBigNumber(amountToFundNormalized || Zero, displayCollateral.decimals)} ${
          displayCollateral.symbol
        }`,
      )
      setIsTransactionProcessing(false)
    } catch (err) {
      setTxState(TransactionStep.error)
      setMessage(`Error trying to deposit funds.`)
      logger.error(`${message} - ${err.message}`)
      setIsTransactionProcessing(false)
    }
  }

  const deposit = async () => {
    if (liquidityMiningCampaign) {
      addFundingAndStake()
    } else {
      addFunding()
    }
  }

  const unstakeClaimAndRemoveFunding = async () => {
    try {
      if (!cpk) {
        return
      }
      if (!liquidityMiningCampaign) {
        throw new Error('No liquidity mining campaign')
      }

      const fundsAmount = formatBigNumber(depositedTokensTotal, collateral.decimals, collateral.decimals)
      setMessage(`Withdrawing funds: ${formatNumber(fundsAmount)} ${displayCollateral.symbol}...`)

      const collateralAddress = await marketMaker.getCollateralToken()
      const conditionId = await marketMaker.getConditionId()

      setTxState(TransactionStep.waitingConfirmation)
      setIsTransactionProcessing(true)
      setIsTransactionModalOpen(true)

      await cpk.unstakeClaimAndWithdraw({
        amountToMerge: depositedTokens,
        campaignAddress: liquidityMiningCampaign.id,
        collateralAddress,
        conditionId,
        conditionalTokens,
        compoundService,
        earnings: userEarnings,
        marketMaker,
        outcomesCount: balances.length,
        setTxHash,
        setTxState,
        sharesToBurn: amountToRemove || Zero,
        useBaseToken: false, // Not using base token for staking
      })

      await fetchGraphMarketMakerData()
      await fetchFundingBalance()
      await fetchCollateralBalance()
      await fetchBalances()
      await fetchStakingData()

      setAmountToRemove(null)
      setAmountToRemoveDisplay('')
      setAmountToRemoveNormalized(null)
      setMessage(`Successfully withdrew ${formatNumber(fundsAmount)} ${displayCollateral.symbol}`)
      setIsTransactionProcessing(false)
    } catch (err) {
      setTxState(TransactionStep.error)
      setMessage(`Error trying to withdraw funds.`)
      logger.error(`${message} - ${err.message}`)
      setIsTransactionProcessing(false)
    }
  }

  const removeFunding = async () => {
    try {
      if (!cpk) {
        return
      }

      let fundsAmount = formatBigNumber(depositedTokensTotal, collateral.decimals, collateral.decimals)
      if (
        compoundService &&
        collateralSymbol in CompoundTokenType &&
        displayCollateral.symbol === baseCollateral.symbol
      ) {
        const displayDepositedTokensTotal = compoundService.calculateCTokenToBaseExchange(
          baseCollateral,
          depositedTokensTotal,
        )
        fundsAmount = formatBigNumber(
          displayDepositedTokensTotal || Zero,
          displayCollateral.decimals,
          displayCollateral.decimals,
        )
      }
      setMessage(`Withdrawing funds: ${formatNumber(fundsAmount)} ${displayCollateral.symbol}...`)

      const collateralAddress = await marketMaker.getCollateralToken()
      const conditionId = await marketMaker.getConditionId()
      let useBaseToken = false
      if (displayCollateral.address === pseudoNativeAssetAddress) {
        useBaseToken = true
      } else if (collateral.symbol.toLowerCase() in CompoundTokenType) {
        if (displayCollateral.address !== collateral.address) {
          useBaseToken = true
        }
      }
      setTxState(TransactionStep.waitingConfirmation)
      setIsTransactionProcessing(true)
      setIsTransactionModalOpen(true)
      await cpk.removeFunding({
        amountToMerge: depositedTokens,
        collateralAddress,
        conditionId,
        conditionalTokens,
        compoundService,
        earnings: userEarnings,
        marketMaker,
        outcomesCount: balances.length,
        setTxHash,
        setTxState,
        sharesToBurn: amountToRemove || Zero,
        useBaseToken,
      })
      await fetchGraphMarketMakerData()
      await fetchFundingBalance()
      await fetchCollateralBalance()
      await fetchBalances()

      setAmountToRemove(null)
      setAmountToRemoveDisplay('')
      setAmountToRemoveNormalized(null)
      setMessage(`Successfully withdrew ${formatNumber(fundsAmount)} ${displayCollateral.symbol}`)
      setIsTransactionProcessing(false)
    } catch (err) {
      setTxState(TransactionStep.error)
      setMessage(`Error trying to withdraw funds.`)
      logger.error(`${message} - ${err.message}`)
      setIsTransactionProcessing(false)
    }
  }

  const withdraw = () => {
    if (liquidityMiningCampaign) {
      unstakeClaimAndRemoveFunding()
    } else {
      removeFunding()
    }
  }

  const claim = async () => {
    try {
      if (!cpk) {
        return
      }
      if (!liquidityMiningCampaign) {
        throw new Error('No liquidity mining campaign')
      }
      if (!account) {
        throw new Error('Please connect to your wallet to perform this action.')
      }

      const stakingService = new StakingService(provider, cpk.address, liquidityMiningCampaign.id)
      const claimableRewards = await stakingService.getClaimableRewards(cpk.address)

      setMessage(
        `Claiming ${formatNumber(
          formatBigNumber(
            claimableRewards[0],
            getToken(networkId, 'omn').decimals,
            getToken(networkId, 'omn').decimals,
          ),
        )} OMN`,
      )
      setIcon(true)

      setTxState(TransactionStep.waitingConfirmation)
      setIsTransactionProcessing(true)
      setIsTransactionModalOpen(true)

      await cpk.claimRewardTokens(liquidityMiningCampaign.id, setTxHash, setTxState)

      await fetchGraphMarketMakerData()
      await fetchFundingBalance()
      await fetchCollateralBalance()
      await fetchBalances()
      await fetchStakingData()

      setIcon(false)
      setMessage(`Successfully claimed OMN rewards`)
      setIsTransactionProcessing(false)
    } catch (err) {
      setIcon(false)
      setTxState(TransactionStep.error)
      setMessage(`Error trying to claim OMN rewards.`)
      logger.error(`${message} - ${err.message}`)
      setIsTransactionProcessing(false)
    }
  }

  const { liquidityMiningCampaigns } = useGraphLiquidityMiningCampaigns()

  useEffect(() => {
    if (liquidityMiningCampaigns) {
      const marketLiquidityMiningCampaign = liquidityMiningCampaigns.filter(campaign => {
        return campaign.fpmm.id === marketMakerAddress
      })[0]
      setLiquidityMiningCampaign(marketLiquidityMiningCampaign)
    }
  }, [liquidityMiningCampaigns, marketMakerAddress, cpk, cpk?.address])

  const fetchStakingData = async () => {
    if (!liquidityMiningCampaign) {
      throw new Error('No liquidity mining campaign')
    }
    if (!cpk) {
      throw new Error('No cpk')
    }

    const stakingService = new StakingService(provider, cpk && cpk.address, liquidityMiningCampaign.id)

    console.log(liquidityMiningCampaign.id)

    const { earnedRewards, remainingRewards, rewardApr, totalRewards } = await stakingService.getStakingData(
      getToken(networkId, 'omn'),
      cpk.address,
      1, // Assume pool token value is 1 DAI
      // TODO: Replace hardcoded price param
      1,
      Number(liquidityMiningCampaign.endsAt),
      liquidityMiningCampaign.rewardAmounts[0],
      Number(liquidityMiningCampaign.duration),
    )
    const userStakedTokens = await stakingService?.getStakedTokensOfAmount(cpk.address)

    setUserStakedTokens(bigNumberify(userStakedTokens || 0))
    setEarnedRewards(earnedRewards)
    setRemainingRewards(remainingRewards)
    setRewardApr(rewardApr)
    setTotalRewards(totalRewards)
  }

  useEffect(() => {
    cpk && liquidityMiningCampaign && fetchStakingData()
  }, [cpk?.address, liquidityMiningCampaign, cpk])

  const unlockCollateral = async () => {
    if (!cpk) {
      return
    }

    await unlock()

    setAllowanceFinished(true)
  }

  const showUpgrade =
    (!isUpdated && collateral.address === pseudoNativeAssetAddress) ||
    (upgradeFinished && collateral.address === pseudoNativeAssetAddress)

  const upgradeProxy = async () => {
    if (!cpk) {
      return
    }

    await updateProxy()
    setUpgradeFinished(true)
  }

  const collateralAmountError = isTransactionProcessing
    ? null
    : maybeCollateralBalance === null
    ? null
    : maybeCollateralBalance.isZero() && amountToFund?.gt(maybeCollateralBalance)
    ? `Insufficient balance`
    : amountToFund?.gt(maybeCollateralBalance)
    ? `Value must be less than or equal to ${walletBalance} ${collateral.symbol}`
    : null

  const disableDepositButton =
    !amountToFund ||
    amountToFund?.isZero() ||
    (!cpk?.isSafeApp && collateral.address !== pseudoNativeAssetAddress && hasEnoughAllowance !== Ternary.True) ||
    collateralAmountError !== null ||
    currentDate > resolutionDate ||
    isNegativeAmountToFund

  const setDisplayCollateralAmountToFund = (value: BigNumber) => {
    if (collateral.address === displayCollateral.address) {
      setAmountToFund(value)
    } else if (compoundService) {
      const baseAmount = compoundService.calculateBaseToCTokenExchange(displayCollateral, value)
      setAmountToFund(baseAmount)
    }
    setAmountToFundNormalized(value)
  }

  const setWithdrawAmountToRemove = (val: BigNumber) => {
    let normalizedWithdrawAmount = val
    if (compoundService && collateral.symbol.toLowerCase() in CompoundTokenType) {
      normalizedWithdrawAmount = compoundService.calculateBaseToCTokenExchange(baseCollateral, normalizedWithdrawAmount)
    }
    setAmountToRemove(normalizedWithdrawAmount)
    setAmountToRemoveNormalized(val)
  }

  let currencyFilters =
    collateral.address === wrapToken.address || collateral.address === pseudoNativeAssetAddress
      ? [wrapToken.address.toLowerCase(), pseudoNativeAssetAddress.toLowerCase()]
      : []

  if (collateralSymbol in CompoundTokenType) {
    if (baseCollateral.symbol.toLowerCase() === 'eth') {
      currencyFilters = [collateral.address, pseudoNativeAssetAddress.toLowerCase()]
    } else {
      currencyFilters = [collateral.address, baseCollateral.address]
    }
  }

  let displayBalances = balances
  if (compoundService && collateral.symbol.toLowerCase() in CompoundTokenType) {
    displayBalances = getSharesInBaseToken(balances, compoundService, displayCollateral)
  }
  const shouldDisplayMaxButton = collateral.address !== pseudoNativeAssetAddress

  let displayTotalUserLiquidity = totalUserLiquidity
  let displayUserEarnings = userEarnings
  let displayTotalEarnings = totalEarnings
  let displayPoolTokens = poolTokens
  let displayTotalPoolShares = totalPoolShares
  let displaySharesAfterAddingFunding = sharesAfterAddingFunding
  let displaySharesAfterRemovingFunding = sharesAfterRemovingFunding
  let displayFundingBalance = userStakedTokens && userStakedTokens.gt(0) ? userStakedTokens : fundingBalance
  let displaySharesBalance =
    userStakedTokens && userStakedTokens.gt(0) ? formatBigNumber(userStakedTokens, STANDARD_DECIMALS) : sharesBalance
  let sellNoteUserEarnings = userEarnings
  let sellNoteDepositedTokens = depositedTokens
  let sellNoteDepositedTokensTotal = depositedTokensTotal
  // Set display values if the collateral is cToken type
  if (compoundService && collateralSymbol in CompoundTokenType) {
    displayPoolTokens = compoundService.calculateCTokenToBaseExchange(baseCollateral, poolTokens)
    displayTotalPoolShares = compoundService.calculateCTokenToBaseExchange(baseCollateral, totalPoolShares)
    displayTotalUserLiquidity = compoundService.calculateCTokenToBaseExchange(displayCollateral, totalUserLiquidity)
    displayUserEarnings = compoundService.calculateCTokenToBaseExchange(displayCollateral, userEarnings)
    displayTotalEarnings = compoundService.calculateCTokenToBaseExchange(displayCollateral, totalEarnings)
    displayFundingBalance = compoundService.calculateCTokenToBaseExchange(baseCollateral, fundingBalance)
    displaySharesAfterAddingFunding = sharesAfterAddingFunding.map(function(saf) {
      return compoundService.calculateCTokenToBaseExchange(baseCollateral, saf)
    })
    displaySharesAfterRemovingFunding = sharesAfterRemovingFunding.map(function(srf) {
      return compoundService.calculateCTokenToBaseExchange(baseCollateral, srf)
    })
    const sharesBalanceBN = compoundService.calculateCTokenToBaseExchange(baseCollateral, fundingBalance)
    displaySharesBalance = formatBigNumber(sharesBalanceBN, baseCollateral.decimals)
    if (displayCollateral.address === baseCollateral.address) {
      sellNoteUserEarnings = displayUserEarnings
      sellNoteDepositedTokens = compoundService.calculateCTokenToBaseExchange(baseCollateral, depositedTokens)
      sellNoteDepositedTokensTotal = compoundService.calculateCTokenToBaseExchange(baseCollateral, depositedTokensTotal)
    }
  }

  const sharesAmountError = isTransactionProcessing
    ? null
    : maybeFundingBalance === null
    ? null
    : maybeFundingBalance.isZero() && amountToRemove?.gt(maybeFundingBalance) && amountToRemove?.gt(userStakedTokens)
    ? `Insufficient balance`
    : amountToRemoveNormalized?.gt(displayFundingBalance)
    ? `Value must be less than or equal to ${displaySharesBalance} pool shares`
    : null

  const disableWithdrawButton =
    !amountToRemove ||
    amountToRemove?.isZero() ||
    amountToRemoveNormalized?.gt(displayFundingBalance) ||
    sharesAmountError !== null ||
    isNegativeAmountToRemove

  let toggleCollateral = collateral

  if (collateralSymbol in CompoundTokenType) {
    if (collateral.address === displayCollateral.address) {
      toggleCollateral = baseCollateral
    } else {
      toggleCollateral = collateral
    }
  } else {
    if (collateral.address === nativeAsset.address || collateral.address === wrapToken.address) {
      if (displayCollateral.address === wrapToken.address) {
        toggleCollateral = getNativeAsset(networkId, relay)
      } else {
        toggleCollateral = getWrapToken(networkId)
      }
    }
  }
  const setToggleCollateral = () => {
    if (collateralSymbol in CompoundTokenType) {
      if (displayCollateral.address === baseCollateral.address) {
        setDisplayCollateral(collateral)
      } else {
        setDisplayCollateral(baseCollateral)
      }
    } else {
      if (displayCollateral.address === wrapToken.address) {
        setDisplayCollateral(getNativeAsset(networkId, relay))
      } else {
        setDisplayCollateral(getWrapToken(networkId))
      }
    }
  }

  const setBuyCollateral = (token: Token) => {
    const userInputCollateralSymbol = token.symbol.toLowerCase()
    if (userInputCollateralSymbol in CompoundTokenType) {
      setDisplayCollateral(token)
    } else if (token.address === pseudoNativeAssetAddress && !(collateral.symbol.toLowerCase() in CompoundTokenType)) {
      setCollateral(token)
      setDisplayCollateral(token)
    } else {
      setDisplayCollateral(token)
    }
  }
  const switchTab = (tab: Tabs) => {
    if (collateralSymbol in CompoundTokenType) {
      setDisplayCollateral(baseCollateral)
    }
    setAmountToFund(new BigNumber('0'))
    setWithdrawAmountToRemove(new BigNumber('0'))
    setActiveTab(tab)
  }

  const currencySelectorIsDisabled = relay ? true : currencyFilters.length ? false : true

  return (
    <>
      <UserPoolData
        collateral={baseCollateral}
        currentApr={rewardApr}
        earnedRewards={earnedRewards}
        remainingRewards={remainingRewards}
        symbol={symbol}
        totalEarnings={displayTotalEarnings}
        totalPoolShares={displayTotalPoolShares}
        totalRewards={totalRewards}
        totalUserLiquidity={displayTotalUserLiquidity}
        userEarnings={displayUserEarnings}
      />
      <OutcomeTable
        balances={balances}
        collateral={collateral}
        disabledColumns={[OutcomeTableValue.OutcomeProbability, OutcomeTableValue.Payout, OutcomeTableValue.Bonded]}
        displayBalances={displayBalances}
        displayCollateral={baseCollateral}
        displayRadioSelection={false}
        newShares={activeTab === Tabs.deposit ? displaySharesAfterAddingFunding : displaySharesAfterRemovingFunding}
        probabilities={probabilities}
        showSharesChange={showSharesChange}
      />
      <GridTransactionDetails>
        <div>
          <TabsGrid>
            <ButtonTab
              active={disableDepositTab ? false : activeTab === Tabs.deposit}
              disabled={disableDepositTab}
              onClick={() => switchTab(Tabs.deposit)}
            >
              Deposit
            </ButtonTab>
            <ButtonTab
              active={disableDepositTab ? true : activeTab === Tabs.withdraw}
              onClick={() => switchTab(Tabs.withdraw)}
            >
              Withdraw
            </ButtonTab>
          </TabsGrid>
          {activeTab === Tabs.deposit && (
            <>
              <CurrenciesWrapper>
                <CurrencySelector
                  addBalances
                  addNativeAsset
                  balance={walletBalance}
                  context={context}
                  currency={displayCollateral.address}
                  disabled={currencySelectorIsDisabled}
                  filters={currencyFilters}
                  onSelect={(token: Token | null) => {
                    if (token) {
                      setBuyCollateral(token)
                      setDisplayCollateralAmountToFund(new BigNumber(0))
                    }
                  }}
                />
              </CurrenciesWrapper>

              <TextfieldCustomPlaceholder
                formField={
                  <BigNumberInput
                    decimals={displayCollateral.decimals}
                    name="amountToFund"
                    onChange={(e: BigNumberInputReturn) => {
                      setDisplayCollateralAmountToFund(e.value)
                      setAmountToFundDisplay('')
                    }}
                    style={{ width: 0 }}
                    value={amountToFundNormalized}
                    valueToDisplay={amountToFundDisplay}
                  />
                }
                onClickMaxButton={() => {
                  setAmountToFund(collateralBalance)
                  setAmountToFundDisplay(formatBigNumber(collateralBalance, displayCollateral.decimals, 5))
                }}
                shouldDisplayMaxButton={shouldDisplayMaxButton}
                symbol={displayCollateral.symbol}
              />

              {collateralAmountError && <GenericError>{collateralAmountError}</GenericError>}
            </>
          )}
          {activeTab === Tabs.withdraw && (
            <>
              <TokenBalance
                text={`${userStakedTokens.gt(0) ? 'Staked' : 'Pool'} Tokens`}
                value={
                  userStakedTokens.gt(0)
                    ? formatBigNumber(userStakedTokens, STANDARD_DECIMALS)
                    : formatNumber(displaySharesBalance)
                }
              />

              <TextfieldCustomPlaceholder
                formField={
                  <BigNumberInput
                    decimals={baseCollateral.decimals}
                    name="amountToRemove"
                    onChange={(e: BigNumberInputReturn) => {
                      setWithdrawAmountToRemove(e.value)
                      setAmountToRemoveDisplay('')
                    }}
                    style={{ width: 0 }}
                    value={amountToRemoveNormalized}
                    valueToDisplay={amountToRemoveDisplay}
                  />
                }
                onClickMaxButton={() => {
                  setAmountToRemove(userStakedTokens && userStakedTokens.gt(0) ? userStakedTokens : fundingBalance)
                  setAmountToRemoveDisplay(formatBigNumber(displayFundingBalance, baseCollateral.decimals, 5))
                }}
                shouldDisplayMaxButton
                symbol=""
              />

              {sharesAmountError && <GenericError>{sharesAmountError}</GenericError>}
            </>
          )}
        </div>
        <div>
          {activeTab === Tabs.deposit && (
            <TransactionDetailsCard>
              <TransactionDetailsRow
                emphasizeValue={fee.gt(0)}
                state={ValueStates.success}
                title="Earn Trading Fee"
                value={feeFormatted}
              />
              <TransactionDetailsLine />
              <TransactionDetailsRow
                emphasizeValue={displayPoolTokens.gt(0)}
                state={(displayPoolTokens.gt(0) && ValueStates.important) || ValueStates.normal}
                title="Pool Tokens"
                value={`${formatNumber(
                  formatBigNumber(displayPoolTokens, baseCollateral.decimals, baseCollateral.decimals),
                )}`}
              />
            </TransactionDetailsCard>
          )}
          {activeTab === Tabs.withdraw && (
            <TransactionDetailsCard>
              <TransactionDetailsRow
                emphasizeValue={userEarnings.gt(0)}
                state={ValueStates.success}
                title="Earned"
                value={`${formatNumber(
                  formatBigNumber(sellNoteUserEarnings, displayCollateral.decimals, displayCollateral.decimals),
                )} ${displayTotalSymbol}`}
              />
              <TransactionDetailsRow
                state={ValueStates.normal}
                title="Deposited"
                value={`${formatNumber(
                  formatBigNumber(sellNoteDepositedTokens, displayCollateral.decimals, displayCollateral.decimals),
                )} ${displayTotalSymbol}`}
              />
              <TransactionDetailsLine />
              <TransactionDetailsRow
                emphasizeValue={sellNoteDepositedTokensTotal.gt(0)}
                state={(sellNoteDepositedTokensTotal.gt(0) && ValueStates.important) || ValueStates.normal}
                title="Total"
                value={`${formatNumber(
                  formatBigNumber(sellNoteDepositedTokensTotal, displayCollateral.decimals, displayCollateral.decimals),
                )} ${displayTotalSymbol}`}
              />
              {!relay && collateral.address === pseudoNativeAssetAddress ? (
                <SwitchTransactionToken onToggleCollateral={setToggleCollateral} toggleCollatral={toggleCollateral} />
              ) : collateralSymbol in CompoundTokenType ? (
                <SwitchTransactionToken onToggleCollateral={setToggleCollateral} toggleCollatral={toggleCollateral} />
              ) : (
                <span />
              )}
            </TransactionDetailsCard>
          )}
        </div>
      </GridTransactionDetails>
      {activeTab === Tabs.deposit && showSetAllowance && (
        <SetAllowanceStyled
          collateral={displayCollateral}
          finished={allowanceFinished && RemoteData.is.success(allowance)}
          loading={RemoteData.is.asking(allowance)}
          onUnlock={unlockCollateral}
        />
      )}
      {activeTab === Tabs.deposit && showUpgrade && (
        <SetAllowanceStyled
          collateral={getNativeAsset(networkId, relay)}
          finished={upgradeFinished && RemoteData.is.success(proxyIsUpToDate)}
          loading={RemoteData.is.asking(proxyIsUpToDate)}
          onUnlock={upgradeProxy}
        />
      )}
      <WarningMessageStyled
        additionalDescription=""
        description="Providing liquidity is risky and could result in near total loss. It is important to withdraw liquidity before the event occurs and to be aware the market could move abruptly at any time."
        href={DOCUMENT_FAQ}
        hyperlinkDescription="More Info"
      />
      {isNegativeAmountToFund && (
        <WarningMessage
          additionalDescription=""
          danger={true}
          description="Your deposit amount should not be negative."
          href=""
          hyperlinkDescription=""
        />
      )}
      {isNegativeAmountToRemove && (
        <WarningMessage
          additionalDescription=""
          danger
          description="Your withdraw amount should not be negative."
          href=""
          hyperlinkDescription=""
        />
      )}
      <BottomButtonWrapper borderTop>
        <Button buttonType={ButtonType.secondaryLine} onClick={() => history.goBack()}>
          Back
        </Button>
        <BottomButtonRight>
          {liquidityMiningCampaign && (
            <Button
              buttonType={ButtonType.secondaryLine}
              disabled={!(userStakedTokens && userStakedTokens.gt(0) && earnedRewards > 0)}
              onClick={() => claim()}
              style={{ marginRight: 12 }}
            >
              Claim Rewards
            </Button>
          )}
          {activeTab === Tabs.deposit && (
            <Button buttonType={ButtonType.secondaryLine} disabled={disableDepositButton} onClick={() => deposit()}>
              Deposit
            </Button>
          )}
          {activeTab === Tabs.withdraw && (
            <Button buttonType={ButtonType.secondaryLine} disabled={disableWithdrawButton} onClick={() => withdraw()}>
              Withdraw
            </Button>
          )}
        </BottomButtonRight>
      </BottomButtonWrapper>
      <ModalTransactionWrapper
        confirmations={0}
        confirmationsRequired={0}
        icon={icon && <IconOmen size={24} style={{ marginLeft: '10px' }} />}
        isOpen={isTransactionModalOpen}
        message={message}
        onClose={() => setIsTransactionModalOpen(false)}
        txHash={txHash}
        txState={txState}
      />
    </>
  )
}

export const MarketPoolLiquidity = withRouter(MarketPoolLiquidityWrapper)
