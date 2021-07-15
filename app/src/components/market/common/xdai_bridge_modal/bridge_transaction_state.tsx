import { BigNumber } from 'ethers/utils'
import React, { useEffect } from 'react'
import styled from 'styled-components'

import { CONFIRMATION_COUNT, STANDARD_DECIMALS } from '../../../../common/constants'
import { getTxHashBlockExplorerURL, networkIds } from '../../../../util/networks'
import { formatBigNumber } from '../../../../util/tools'
import { TransactionStep } from '../../../../util/types'
import { ButtonRound } from '../../../button/button_round'
import { IconArrowUp } from '../../../common/icons/IconArrowUp'
import { InlineLoading } from '../../../loading/inline_loading'

interface Prop {
  transactionModalVisibility: any
  state: TransactionStep
  amountToTransfer: BigNumber
  network: number
  transactionHash: string
  numberOfConfirmations: any
  fetchBalance: any
  setBridgeOpen: any
}

const MainWrapper = styled.div`
  text-align: center;
  user-select: text;
`

const SvgWrapper = styled.div`
  margin-bottom: 25px;
`
const BoldedText = styled.div`
  color: ${props => props.theme.text1};
  font-family: Roboto;
  font-weight: 500;
  font-size: 14px;
  line-height: 16px;
`
const CloseButton = styled(ButtonRound)`
  width: 100%;
  margin-top: 20px;
`
const ChainText = styled.div`
  margin-top: 8px;
  margin-bottom: 16px;
`
const TransactionText = styled.div`
  color: ${props => props.theme.text4};
`
const TransactionLink = styled.a`
  color: ${props => props.theme.primary2};
`
const IconWrapper = styled.div`
  color: ${props => props.theme.green};
`

export const TransactionState = ({
  amountToTransfer,
  fetchBalance,
  network,
  numberOfConfirmations,
  setBridgeOpen,
  state,
  transactionHash,
  transactionModalVisibility,
}: Prop) => {
  useEffect(() => {
    if (state === TransactionStep.error) {
      transactionModalVisibility(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, numberOfConfirmations])
  return (
    <MainWrapper>
      <SvgWrapper>
        {state === TransactionStep.waitingConfirmation ? (
          <InlineLoading message="" />
        ) : state === TransactionStep.transactionSubmitted ? (
          <IconArrowUp />
        ) : (
          <IconWrapper>
            <IconArrowUp />
          </IconWrapper>
        )}
      </SvgWrapper>

      <BoldedText>
        Transfer {formatBigNumber(amountToTransfer, STANDARD_DECIMALS)}{' '}
        {network === networkIds.MAINNET ? 'DAI' : 'XDAI'}
      </BoldedText>
      <ChainText>to {network === networkIds.MAINNET ? 'xDai Chain' : 'Mainnet'}</ChainText>

      {state === TransactionStep.waitingConfirmation ? (
        <TransactionText>Waiting confirmation</TransactionText>
      ) : (state === TransactionStep.transactionSubmitted || state === TransactionStep.transactionConfirmed) &&
        numberOfConfirmations === 0 ? (
        <TransactionLink
          href={getTxHashBlockExplorerURL(network, transactionHash)}
          rel="noopener noreferrer"
          target="_blank"
        >
          {state === TransactionStep.transactionConfirmed ? 'Transaction Confirmed' : 'Transaction submitted'}
        </TransactionLink>
      ) : state === TransactionStep.transactionSubmitted && numberOfConfirmations > 0 ? (
        <TransactionText>
          {numberOfConfirmations}/{CONFIRMATION_COUNT} confirmations
        </TransactionText>
      ) : (
        ''
      )}
      <CloseButton
        onClick={() => {
          fetchBalance()
          transactionModalVisibility(false)
          if (state !== TransactionStep.transactionConfirmed) setBridgeOpen(false)
        }}
      >
        {state === TransactionStep.transactionConfirmed ? 'Transfer Again' : 'Close'}
      </CloseButton>
    </MainWrapper>
  )
}
