import React, { FC, useState } from 'react'
import moment from 'moment'

import { getLogger } from '../../util/logger'
import { MarketWizardCreator, MarketData } from './market_wizard_creator'
import { ERC20Service } from '../../services'
import { getArbitrator, getContractAddress } from '../../util/networks'
import { useConnectedWeb3Context } from '../../hooks/connectedWeb3'
import { useContracts } from '../../hooks/useContracts'
import { ModalConnectWallet } from '../common/modal_connect_wallet'
import { MarketCreationStatus } from '../../util/market_creation_status_data'

const logger = getLogger('Market::MarketWizardCreatorContainer')

const MarketWizardCreatorContainer: FC = () => {
  const context = useConnectedWeb3Context()
  const { library: provider, networkId, account } = context

  const [isModalOpen, setModalState] = useState(false)
  const { conditionalTokens, marketMakerFactory, realitio, buildMarketMaker } = useContracts(
    context,
  )

  const [marketCreationStatus, setMarketCreationStatus] = useState<MarketCreationStatus>(
    MarketCreationStatus.ready(),
  )
  const [questionId, setQuestionId] = useState<string | null>(null)
  const [marketMakerAddress, setMarketMakerAddress] = useState<string | null>(null)

  const handleSubmit = async (data: MarketData) => {
    try {
      if (!account) {
        setModalState(true)
      } else {
        if (!data.resolution) {
          throw new Error('resolution time was not specified')
        }
        const user = await provider.getSigner().getAddress()
        const { collateral, arbitratorId, question, resolution, funding, outcomes, category } = data
        const openingDateMoment = moment(resolution)

        const collateralService = new ERC20Service(provider, account, collateral.address)

        const arbitrator = getArbitrator(networkId, arbitratorId)

        setMarketCreationStatus(MarketCreationStatus.postingQuestion())
        const questionId = await realitio.askQuestion(
          question,
          outcomes,
          category,
          arbitrator.address,
          openingDateMoment,
          networkId,
        )
        setQuestionId(questionId)

        setMarketCreationStatus(MarketCreationStatus.prepareCondition())

        const oracleAddress = getContractAddress(networkId, 'oracle')
        const conditionId = await conditionalTokens.prepareCondition(
          questionId,
          oracleAddress,
          outcomes.length,
        )

        // approve movement of collateral token to MarketMakerFactory
        setMarketCreationStatus(MarketCreationStatus.approvingCollateral())

        const marketMakerFactoryAddress = getContractAddress(networkId, 'marketMakerFactory')

        const hasEnoughAlowance = await collateralService.hasEnoughAllowance(
          user,
          marketMakerFactoryAddress,
          funding,
        )

        if (!hasEnoughAlowance) {
          await collateralService.approve(marketMakerFactoryAddress, funding)
        }

        setMarketCreationStatus(MarketCreationStatus.createMarketMaker())
        const marketMakerAddress = await marketMakerFactory.createMarketMaker(
          conditionalTokens.address,
          collateral.address,
          conditionId,
        )
        setMarketMakerAddress(marketMakerAddress)

        setMarketCreationStatus(MarketCreationStatus.approveCollateralForMarketMaker())
        await collateralService.approveUnlimited(marketMakerAddress)

        setMarketCreationStatus(MarketCreationStatus.addFunding())
        const marketMakerService = buildMarketMaker(marketMakerAddress)
        await marketMakerService.addInitialFunding(funding, outcomes.map(o => o.probability))

        setMarketCreationStatus(MarketCreationStatus.done())
      }
    } catch (err) {
      setMarketCreationStatus(MarketCreationStatus.error(err))
      logger.error(err.message)
    }
  }

  return (
    <>
      <MarketWizardCreator
        callback={handleSubmit}
        marketMakerAddress={marketMakerAddress}
        questionId={questionId}
        marketCreationStatus={marketCreationStatus}
      />
      <ModalConnectWallet isOpen={isModalOpen} onClose={() => setModalState(false)} />
    </>
  )
}

export { MarketWizardCreatorContainer }
