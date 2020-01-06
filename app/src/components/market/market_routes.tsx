import React, { useState } from 'react'
import { Redirect, Route, RouteComponentProps, Switch } from 'react-router'
import { ethers } from 'ethers'

import { MarketBuyPage, MarketDetailsPage, MarketFundPage, MarketSellPage } from '../../pages'
import { isAddress } from '../../util/tools'
import { ConnectedWeb3, useConnectedWeb3Context, useConnectWeb3 } from '../../hooks/connectedWeb3'
import { useCheckContractExists } from '../../hooks/useCheckContractExists'
import { useMarketMakerData } from '../../hooks/useMarketMakerData'
import { SectionTitle } from '../common/section_title'
import { FullLoading } from '../common/full_loading'
import { MARKET_FEE } from '../../common/constants'
import { getLogger } from '../../util/logger'
import { useWeb3Context } from 'web3-react/dist'
import connectors from '../../util/connectors'
import { Message } from '../common/message'
import { MarketNotFound } from '../common/market_not_found'

const logger = getLogger('Market::Routes')

interface RouteParams {
  address: string
}

interface Props {
  marketMakerAddress: string
}

const MarketValidateContractAddress: React.FC<Props> = (props: Props) => {
  const context = useConnectedWeb3Context()

  const { marketMakerAddress } = props

  const contractExists = useCheckContractExists(marketMakerAddress, context)
  const { marketMakerData } = useMarketMakerData(marketMakerAddress, context)

  if (!contractExists) {
    logger.log(`Market address not found`)
    return <MarketNotFound />
  }

  const { fee } = marketMakerData

  if (fee === null) {
    return <FullLoading />
  }

  const feeBN = ethers.utils.parseEther('' + MARKET_FEE / Math.pow(10, 2))
  if (!fee.eq(feeBN)) {
    logger.log(`Market was not created with this app (different fee)`)
    return <SectionTitle title={'Invalid market'} />
  }

  return (
    <Switch>
      <Route exact path="/:address" component={MarketDetailsPage} />
      <Route exact path="/:address/buy" component={MarketBuyPage} />
      <Route exact path="/:address/sell" component={MarketSellPage} />
      <Route exact path="/:address/fund" component={MarketFundPage} />
    </Switch>
  )
}

const MarketRoutesConnectedWrapper = (props: RouteComponentProps<RouteParams>) => {
  useConnectWeb3()

  const marketMakerAddress = props.match.params.address
  if (!isAddress(marketMakerAddress)) {
    logger.log(`Contract address not valid`)
    return <Redirect to="/" />
  }

  return (
    <ConnectedWeb3>
      <MarketValidateContractAddress marketMakerAddress={marketMakerAddress} />
    </ConnectedWeb3>
  )
}

const MarketRoutesDisconnectedWrapper = () => {
  const [displayMessage, setDisplayMessage] = useState(true)

  return (
    <>
      {displayMessage && (
        <Message
          type="warning"
          delay={3000}
          message="Please connect to your wallet to open the market details..."
          onClick={() => setDisplayMessage(false)}
        />
      )}
    </>
  )
}

const MarketRoutes = (props: RouteComponentProps<RouteParams>) => {
  const { active } = useWeb3Context()
  const connector = localStorage.getItem('CONNECTOR')

  return active || (connector && connector in connectors) ? (
    <MarketRoutesConnectedWrapper {...props} />
  ) : (
    <MarketRoutesDisconnectedWrapper />
  )
}

export { MarketRoutes }
