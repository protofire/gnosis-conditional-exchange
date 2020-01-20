import React, { useState } from 'react'
import styled from 'styled-components'
import { withRouter, RouteComponentProps } from 'react-router-dom'

import { ThreeBoxComments } from '../../common/three_box_comments'
import { ViewCard } from '../../common/view_card'
import { Status, BalanceItem, Token, Arbitrator, OutcomeTableValue } from '../../../util/types'
import { ButtonAnchor, OutcomeTable } from '../../common'
import { FullLoading } from '../../common/full_loading'
import { ButtonContainer } from '../../common/button_container'
import { SubsectionTitle } from '../../common/subsection_title'
import { BigNumber } from 'ethers/utils'
import { TitleValue } from '../../common/title_value'
import { DisplayArbitrator } from '../../common/display_arbitrator'
import { GridThreeColumns } from '../../common/grid_three_columns'
import { WhenConnected } from '../../../hooks/connectedWeb3'
import { ModalConnectWallet } from '../../common/modal_connect_wallet'

const SubsectionTitleStyled = styled(SubsectionTitle)`
  margin-bottom: 0;
`

interface Props extends RouteComponentProps<{}> {
  account: Maybe<string>
  balances: BalanceItem[]
  collateral: Token
  arbitrator: Maybe<Arbitrator>
  question: string
  questionId: string
  category: string
  status: Status
  marketMakerAddress: string
  funding: BigNumber
  location: any
}

const ViewWrapper = (props: Props) => {
  const {
    account,
    balances,
    collateral,
    status,
    questionId,
    marketMakerAddress,
    arbitrator,
    category,
    history,
  } = props

  const userHasShares = balances.some((balanceItem: BalanceItem) => {
    const { shares } = balanceItem
    return !shares.isZero()
  })

  const probabilities = balances.map(balance => balance.probability)
  const [isModalOpen, setModalState] = useState(false)
  const [nextPath, setNextPath] = useState<Maybe<string>>(null)

  React.useEffect(() => {
    if (account && nextPath) {
      history.replace({ pathname: nextPath })
    }
  }, [account, nextPath])

  const renderTableData = () => {
    const disabledColumns = [OutcomeTableValue.Payout]
    if (!userHasShares) {
      disabledColumns.push(OutcomeTableValue.Shares)
    }
    return (
      <OutcomeTable
        balances={balances}
        collateral={collateral}
        displayRadioSelection={false}
        disabledColumns={disabledColumns}
        probabilities={probabilities}
      />
    )
  }

  const details = () => {
    return (
      <>
        <SubsectionTitle>Details</SubsectionTitle>
        <GridThreeColumns>
          {category && <TitleValue title={'Category'} value={category} />}
          <TitleValue
            title={'Arbitrator'}
            value={arbitrator && <DisplayArbitrator arbitrator={arbitrator} />}
          />
          {questionId && (
            <TitleValue
              title={'Realitio'}
              value={
                <a
                  href={`https://realitio.github.io/#!/question/${questionId}`}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  Question URL
                </a>
              }
            />
          )}
        </GridThreeColumns>
      </>
    )
  }

  const marketHasDetails = category || arbitrator

  return (
    <>
      <ViewCard>
        <SubsectionTitleStyled>Outcomes</SubsectionTitleStyled>
        {renderTableData()}
        {marketHasDetails && details()}
        <ButtonContainer>
          <ButtonAnchor
            onClick={() => {
              if (!account) {
                setModalState(true)
              }
              setNextPath(`${marketMakerAddress}/fund`)
            }}
          >
            Fund
          </ButtonAnchor>
          {userHasShares && (
            <ButtonAnchor
              onClick={() => {
                if (!account) {
                  setModalState(true)
                }
                setNextPath(`${marketMakerAddress}/sell`)
              }}
            >
              Sell
            </ButtonAnchor>
          )}
          <ButtonAnchor
            onClick={() => {
              if (!account) {
                setModalState(true)
              }
              setNextPath(`${marketMakerAddress}/buy`)
            }}
          >
            Buy
          </ButtonAnchor>
        </ButtonContainer>
      </ViewCard>
      <WhenConnected>
        <ThreeBoxComments threadName={marketMakerAddress} />
      </WhenConnected>
      <ModalConnectWallet isOpen={isModalOpen} onClose={() => setModalState(false)} />

      {status === Status.Loading ? <FullLoading /> : null}
    </>
  )
}

export const View = withRouter(ViewWrapper)
