import React, { FC, useState } from 'react'
import { useHistory } from 'react-router'

import { useConnectedWeb3Context } from '../../../../contexts/connectedWeb3'
import { useContracts } from '../../../../hooks'
import { ERC20Service } from '../../../../services'
import { CompoundService } from '../../../../services/compound_service'
import { getLogger } from '../../../../util/logger'
import { MarketCreationStatus } from '../../../../util/market_creation_status_data'
import { getToken, pseudoNativeAssetAddress } from '../../../../util/networks'
import { MarketData, TransactionStep } from '../../../../util/types'
import { ModalConnectWalletWrapper, ModalTransactionWrapper } from '../../../modal'

import { MarketWizardCreator } from './market_wizard_creator'

const logger = getLogger('Market::MarketWizardCreatorContainer')

const MarketWizardCreatorContainer: FC = () => {
  const context = useConnectedWeb3Context()
  const { fetchBalances } = context.balances
  const { account, cpk, library: provider } = context
  const history = useHistory()

  const [isModalOpen, setModalState] = useState(false)
  const { conditionalTokens, marketMakerFactory, realitio } = useContracts(context)

  const [marketCreationStatus, setMarketCreationStatus] = useState<MarketCreationStatus>(MarketCreationStatus.ready())
  const [marketMakerAddress, setMarketMakerAddress] = useState<string | null>(null)
  const [message, setMessage] = useState<string>('')
  const [isTransactionModalOpen, setIsTransactionModalOpen] = useState<boolean>(false)
  const [txState, setTxState] = useState<TransactionStep>(TransactionStep.idle)
  const [txHash, setTxHash] = useState('')

  const getCompoundInterestRate = async (symbol: string): Promise<number> => {
    const tokenSymbol = symbol.toLowerCase()
    let cToken = `c${tokenSymbol}`
    if (tokenSymbol === 'weth') {
      cToken = 'ceth'
    }
    const compoundCollateralToken = cToken as KnownToken
    const compoundTokenDetails = getToken(context.networkId, compoundCollateralToken)
    const compoundService = new CompoundService(compoundTokenDetails.address, cToken, provider, account)
    await compoundService.init()
    const supplyRate = compoundService.calculateSupplyRateAPY()
    return supplyRate
  }

  const handleSubmit = async (marketData: MarketData, isScalar: boolean) => {
    try {
      if (!account) {
        setModalState(true)
      } else {
        if (!marketData.resolution) {
          throw new Error('resolution time was not specified')
        }
        if (!cpk) {
          return
        }
        setMarketCreationStatus(MarketCreationStatus.creatingAMarket())

        setTxState(TransactionStep.waitingConfirmation)
        setIsTransactionModalOpen(true)

        if (
          !cpk.isSafeApp &&
          marketData.collateral.address !== pseudoNativeAssetAddress &&
          marketData.userInputCollateral.address !== pseudoNativeAssetAddress
        ) {
          // Approve collateral to the proxy contract
          const collateralService = new ERC20Service(provider, account, marketData.userInputCollateral.address)
          const hasEnoughAlowance = await collateralService.hasEnoughAllowance(account, cpk.address, marketData.funding)
          if (!hasEnoughAlowance) {
            await collateralService.approveUnlimited(cpk.address)
          }
        }
        let compoundTokenDetails = marketData.userInputCollateral
        let compoundService = null
        const userInputCollateralSymbol = marketData.userInputCollateral.symbol.toLowerCase()
        const useCompoundReserve = marketData.useCompoundReserve
        if (useCompoundReserve) {
          const cToken = `c${userInputCollateralSymbol}`
          const compoundCollateralToken = cToken as KnownToken
          compoundTokenDetails = getToken(context.networkId, compoundCollateralToken)
          compoundService = new CompoundService(compoundTokenDetails.address, cToken, provider, account)
          await compoundService.init()
        }
        if (isScalar) {
          setMessage('Creating scalar market...')
          const { marketMakerAddress } = await cpk.createScalarMarket({
            compoundService,
            compoundTokenDetails,
            marketData,
            conditionalTokens,
            realitio,
            marketMakerFactory,
            useCompoundReserve,
            setTxHash,
            setTxState,
          })
          await fetchBalances()
          setMarketMakerAddress(marketMakerAddress)

          setMarketCreationStatus(MarketCreationStatus.done())
          history.replace(`/${marketMakerAddress}`)
        } else {
          setMessage('Creating categorical market...')
          let compoundTokenDetails = marketData.userInputCollateral
          let compoundService = null
          const userInputCollateralSymbol = marketData.userInputCollateral.symbol.toLowerCase()
          const useCompoundReserve = marketData.useCompoundReserve
          if (useCompoundReserve) {
            const cToken = `c${userInputCollateralSymbol}`
            const compoundCollateralToken = cToken as KnownToken
            compoundTokenDetails = getToken(context.networkId, compoundCollateralToken)
            compoundService = new CompoundService(compoundTokenDetails.address, cToken, provider, account)
            await compoundService.init()
          }
          const { marketMakerAddress } = await cpk.createMarket({
            compoundService,
            compoundTokenDetails,
            marketData,
            conditionalTokens,
            realitio,
            marketMakerFactory,
            setTxHash,
            setTxState,
            useCompoundReserve,
          })
          await fetchBalances()
          setMarketMakerAddress(marketMakerAddress)
          setMarketCreationStatus(MarketCreationStatus.done())
          history.replace(`/${marketMakerAddress}`)
        }
      }
    } catch (err) {
      setTxState(TransactionStep.error)
      setMarketCreationStatus(MarketCreationStatus.error(err))
      logger.error(err.message)
    }
  }

  return (
    <>
      <MarketWizardCreator
        callback={handleSubmit}
        getCompoundInterestRate={getCompoundInterestRate}
        marketCreationStatus={marketCreationStatus}
        marketMakerAddress={marketMakerAddress}
      />
      <ModalConnectWalletWrapper isOpen={isModalOpen} onClose={() => setModalState(false)} />
      <ModalTransactionWrapper
        confirmations={0}
        confirmationsRequired={0}
        isOpen={isTransactionModalOpen}
        message={message}
        onClose={() => setIsTransactionModalOpen(false)}
        txHash={txHash}
        txState={txState}
      />
    </>
  )
}

export { MarketWizardCreatorContainer }
