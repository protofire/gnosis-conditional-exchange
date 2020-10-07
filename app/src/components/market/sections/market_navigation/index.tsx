import React from 'react'
import { useHistory } from 'react-router'
import styled from 'styled-components'

const MarketTabs = styled.div`
  display: flex;
  margin-top: -5px;
  margin-bottom: 20px;
`

const MarketTab = styled.div<{ active: boolean }>`
  font-size: 14px;
  color: ${props => (props.active ? props.theme.buttonSecondary.color : props.theme.colors.clickable)};
  background: none;
  border: none;
  border-radius: 32px;
  padding: 10px 18px;
  margin-right: 2px;
  background: ${props => (props.active ? props.theme.buttonSecondary.backgroundColor : `none`)};
  font-weight: ${props => (props.active ? `500` : `400`)};
  cursor: pointer;
`

interface Props {
  activeTab: string
  marketAddress: string
  hasWinningOutcomes?: Maybe<boolean>
  isQuestionFinalized: boolean
  resolutionDate: Date
}

export const MarketNavigation = (props: Props) => {
  const history = useHistory()

  const { activeTab, hasWinningOutcomes, isQuestionFinalized, marketAddress, resolutionDate } = props

  const marketTabs = {
    history: 'HISTORY',
    pool: 'POOL',
    swap: 'SWAP',
    verify: 'VERIFY',
  }

  const isFinalizing = resolutionDate < new Date() && !isQuestionFinalized

  return (
    <MarketTabs>
      <MarketTab active={activeTab === marketTabs.swap} onClick={() => history.push(`/${marketAddress}`)}>
        {isQuestionFinalized && hasWinningOutcomes
          ? 'Redeem'
          : isQuestionFinalized && !hasWinningOutcomes
          ? 'Results'
          : isFinalizing
          ? 'Finalize'
          : 'Swap'}
      </MarketTab>
      <MarketTab
        active={activeTab === marketTabs.pool}
        onClick={() => history.push(`/${marketAddress}/pool-liquidity`)}
      >
        Pool
      </MarketTab>
      {/* Verify is commented out until the underlying infrastructure is ready */}
      {/* <MarketTab 
        active={activeTab === marketTabs.verify} 
        onClick={() => history.push(`/${marketAddress}/verify`)}
      >
        Verify
      </MarketTab> */}
      <MarketTab
        active={activeTab === marketTabs.history}
        onClick={() => history.push(`/${marketAddress}/trade-history`)}
      >
        History
      </MarketTab>
    </MarketTabs>
  )
}
