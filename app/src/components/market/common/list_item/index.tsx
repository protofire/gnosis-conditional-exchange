import moment from 'moment'
import React, { HTMLAttributes, useEffect, useState } from 'react'
import { NavLink } from 'react-router-dom'
import styled from 'styled-components'

import {
  useConnectedCPKContext,
  useConnectedWeb3Context,
  useGraphLiquidityMiningCampaigns,
  useSymbol,
} from '../../../../hooks'
import { GraphResponseLiquidityMiningCampaign } from '../../../../hooks/useGraphLiquidityMiningCampaigns'
import { ERC20Service } from '../../../../services'
import { StakingService } from '../../../../services/staking'
import { getLogger } from '../../../../util/logger'
import { getToken, getTokenFromAddress } from '../../../../util/networks'
import {
  calcPrediction,
  calcPrice,
  formatBigNumber,
  formatNumber,
  formatToShortNumber,
  getScalarTitle,
  getUnit,
  isScalarMarket,
} from '../../../../util/tools'
import { MarketMakerDataItem, Token } from '../../../../util/types'
import { IconApySmall } from '../../../common/icons'
import { IconStar } from '../../../common/icons/IconStar'

const Wrapper = styled(NavLink)`
  border-bottom: 1px solid ${props => props.theme.borders.borderColor};
  cursor: pointer;
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: 22px 25px;
  text-decoration: none;

  &:active,
  &:hover {
    background-color: ${props => props.theme.colors.activeListItemBackground};
  }

  &:last-child {
    border-bottom: none;
  }
`

const Title = styled.h2`
  color: ${props => props.theme.colors.textColorDarker};
  font-size: 15px;
  font-weight: 500;
  line-height: 1.2;
  margin: 0 0 10px 0;
`

const Info = styled.div`
  font-family: 'Roboto';
  align-items: center;
  color: ${props => props.theme.colors.textColorLighter};
  display: flex;
  flex-wrap: wrap;
  font-size: 13px;
  font-weight: 400;
  line-height: 1.2;
  overflow-wrap: break-word;
  white-space: normal;
  word-break: break-all;
`

const Outcome = styled.span`
  color: ${props => props.theme.colors.primaryLight};
  margin-left: 8px;
  font-weight: 500;
  white-space: nowrap;
  text-overflow: ellipsis;
  overflow: hidden;
  max-width: 200px;
`

const ApyIndicator = styled.span`
  color: ${props => props.theme.colors.green};
  margin-left: 6px;
  font-weight: 500;
`

const Separator = styled.span`
  font-size: 18px;
  margin: 0 8px;
  color: ${props => props.theme.colors.verticalDivider};
`

interface Props extends HTMLAttributes<HTMLDivElement> {
  market: MarketMakerDataItem
  currentFilter: any
}

const logger = getLogger('Market::ListItem')

export const ListItem: React.FC<Props> = (props: Props) => {
  const context = useConnectedWeb3Context()
  const { account, library: provider, networkId } = context
  const cpk = useConnectedCPKContext()

  const { currentFilter, market } = props
  const {
    address,
    collateralToken,
    collateralVolume,
    creationTimestamp,
    lastActiveDay,
    openingTimestamp,
    oracle,
    outcomeTokenAmounts,
    outcomeTokenMarginalPrices,
    outcomes,
    runningDailyVolumeByHour,
    scalarHigh,
    scalarLow,
    scaledLiquidityParameter,
    title,
  } = market

  let token: Token | undefined
  try {
    const tokenInfo = getTokenFromAddress(context.networkId, collateralToken)
    const volume = formatBigNumber(collateralVolume, tokenInfo.decimals)
    token = { ...tokenInfo, volume }
  } catch (err) {
    logger.debug(err.message)
  }

  const [details, setDetails] = useState(token || { decimals: 0, symbol: '', volume: '' })
  const [rewardApr, setRewardApr] = useState(0)
  const [liquidityMiningCampaign, setLiquidityMiningCampaign] = useState<Maybe<GraphResponseLiquidityMiningCampaign>>()

  const { decimals, volume } = details
  const symbol = useSymbol(details as Token)
  const now = moment()
  const endDate = openingTimestamp
  const endsText = moment(endDate).fromNow(true)
  const resolutionDate = moment(endDate).format('MMM Do, YYYY')

  const creationDate = new Date(1000 * parseInt(creationTimestamp))
  const formattedCreationDate = moment(creationDate).format('MMM Do, YYYY')

  const formattedLiquidity: string = scaledLiquidityParameter.toFixed(2)

  useEffect(() => {
    const setToken = async () => {
      if (!token) {
        // fallback to token service if unknown token
        const erc20Service = new ERC20Service(provider, account, collateralToken)
        const { decimals, symbol } = await erc20Service.getProfileSummary()
        const volume = formatBigNumber(collateralVolume, decimals)

        setDetails({ symbol, decimals, volume })
      }
    }

    setToken()
  }, [account, collateralToken, collateralVolume, provider, context.networkId, token])

  const { liquidityMiningCampaigns } = useGraphLiquidityMiningCampaigns()

  useEffect(() => {
    if (liquidityMiningCampaigns) {
      const marketLiquidityMiningCampaign = liquidityMiningCampaigns.filter(campaign => {
        return campaign.fpmm.id === address
      })[0]
      setLiquidityMiningCampaign(marketLiquidityMiningCampaign)
    }
  }, [liquidityMiningCampaigns, address])

  useEffect(() => {
    const fetchStakingData = async () => {
      if (!liquidityMiningCampaign) {
        throw 'No liquidity mining campaign'
      }

      const stakingService = new StakingService(provider, cpk && cpk.address, liquidityMiningCampaign.id)

      const { rewardApr } = await stakingService.getStakingData(
        getToken(networkId, 'omn'),
        cpk?.address || '',
        1, // Assume pool token value is 1 DAI
        // TODO: Replace hardcoded price param
        1,
        Number(liquidityMiningCampaign.endsAt),
        liquidityMiningCampaign.rewardAmounts[0],
        Number(liquidityMiningCampaign.duration),
      )

      setRewardApr(rewardApr)
    }

    cpk && liquidityMiningCampaign && fetchStakingData()
  }, [cpk, cpk?.address, liquidityMiningCampaign, networkId, provider])

  const percentages = calcPrice(outcomeTokenAmounts)
  const indexMax = percentages.indexOf(Math.max(...percentages))

  const isScalar = isScalarMarket(oracle || '', context.networkId || 0)

  let currentPrediction
  let unit
  let scalarTitle

  if (isScalar) {
    unit = getUnit(title)
    scalarTitle = getScalarTitle(title)

    if (outcomeTokenMarginalPrices && scalarLow && scalarHigh) {
      currentPrediction = calcPrediction(outcomeTokenMarginalPrices[1], scalarLow, scalarHigh)
    }
  }

  return (
    <Wrapper to={`/${address}`}>
      <Title>{isScalar ? scalarTitle : title}</Title>
      <Info>
        <IconStar></IconStar>
        <Outcome>
          {isScalar
            ? `${currentPrediction ? formatNumber(currentPrediction.toString()) : 'Unknown'} ${unit}`
            : outcomes && `${outcomes[indexMax]} (${(percentages[indexMax] * 100).toFixed(2)}%)`}
        </Outcome>
        <Separator>|</Separator>
        {rewardApr > 0 && (
          <>
            <IconApySmall />
            <ApyIndicator>{formatNumber(rewardApr.toString())}% APY</ApyIndicator>
            <Separator>|</Separator>
          </>
        )}
        <span>{moment(endDate).isAfter(now) ? `${endsText} remaining` : `Closed ${endsText} ago`}</span>
        <Separator>|</Separator>
        <span>
          {currentFilter.sortBy === 'usdVolume' && `${formatToShortNumber(volume || '')} ${symbol} - Volume`}
          {currentFilter.sortBy === 'openingTimestamp' &&
            `${resolutionDate} - ${moment(endDate).isAfter(now) ? 'Closing' : 'Closed'}`}
          {currentFilter.sortBy === `sort24HourVolume${Math.floor(Date.now() / (1000 * 60 * 60)) % 24}` &&
            `${
              Math.floor(Date.now() / 86400000) === lastActiveDay && runningDailyVolumeByHour && decimals
                ? formatToShortNumber(
                    formatBigNumber(runningDailyVolumeByHour[Math.floor(Date.now() / (1000 * 60 * 60)) % 24], decimals),
                  )
                : 0
            } ${symbol} - 24h Volume`}
          {currentFilter.sortBy === 'usdLiquidityParameter' &&
            `${formatToShortNumber(formattedLiquidity)} ${symbol} - Liquidity`}
          {currentFilter.sortBy === 'creationTimestamp' && `${formattedCreationDate} - Created`}
        </span>
      </Info>
    </Wrapper>
  )
}
