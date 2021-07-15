import { ethers } from 'ethers'
import { Zero } from 'ethers/constants'
import { BigNumber } from 'ethers/utils'
import React, { HTMLAttributes, useEffect, useState } from 'react'
import Modal from 'react-modal'
import ReactTooltip from 'react-tooltip'
import styled, { withTheme } from 'styled-components'

import { DAI_TO_XDAI_TOKEN_BRIDGE_ADDRESS, OMNI_BRIDGE_MAINNET_ADDRESS } from '../../../common/constants'
import { useConnectedWeb3Context } from '../../../hooks'
import { ERC20Service, XdaiService } from '../../../services'
import { bridgeTokensList, getNativeAsset, getToken, networkIds } from '../../../util/networks'
import { getImageUrl } from '../../../util/token'
import { formatBigNumber, formatNumber, waitForConfirmations } from '../../../util/tools'
import { ExchangeType, Token, TransactionStep } from '../../../util/types'
import { Button, ButtonStateful } from '../../button'
import { ButtonStates } from '../../button/button_stateful'
import { ButtonType } from '../../button/button_styling_types'
import { BigNumberInput, RadioInput, TextfieldCustomPlaceholder } from '../../common'
import { BigNumberInputReturn } from '../../common/form/big_number_input'
import { IconArrowBack, IconClose } from '../../common/icons'
import { IconAlertInverted } from '../../common/icons/IconAlertInverted'
import { IconInfo } from '../../common/icons/IconInfo'
import { Image } from '../../market/common/token_item'
import {
  BalanceItem,
  BalanceItemBalance,
  BalanceItemSide,
  BalanceItemTitle,
  BalanceItems,
  BalanceSection,
  ContentWrapper,
  ModalCard,
  ModalNavigation,
  ModalNavigationLeft,
  ModalTitle,
} from '../common_styled'
import { ModalTransactionWrapper } from '../modal_transaction'

const InputInfo = styled.div`
  font-size: ${props => props.theme.fonts.defaultSize};
  color: ${props => props.theme.colors.textColorLighter};

  width: 100%;
  margin-bottom: auto;
  margin-top: 20px;
  display: -webkit-box;
  align-items: center;
  border: ${props => props.theme.borders.borderLineDisabled};
  border-radius: 4px;
  padding: ${props => props.theme.textfield.paddingVertical + ' ' + props.theme.textfield.paddingHorizontal};
  line-height: 20px;
  letter-spacing: 0.2px;
`
const WalletText = styled.div`
  margin-bottom: 14px;
  color: ${props => props.theme.colors.textColorLighter};
  line-height: 16.41px;
  letter-spacing: 0.2px;
`

const DepositWithdrawButton = styled(Button)`
  flex: 1;
`
const ApproveButton = styled(ButtonStateful)`
  flex: 1;
  border-color: ${props => props.theme.buttonSecondary.color};

  margin-right: 16px;
  &:hover {
    background-color: ${props => props.theme.colors.primaryLight};
  }
`

const ExchangeDataItem = styled.div`
  display: flex;
  justify-content: space-between;
  width: 100%;
  line-height: ${props => props.theme.fonts.defaultLineHeight};
  letter-spacing: 0.2px;
  color: ${props => props.theme.colors.textColorLightish};
`

const BottomButtons = styled.div`
  display: flex;
  margin-top: auto;
  width: 100%;
  margin-top: 24px;
`

const Divider = styled.div`
  border-bottom: ${props => props.theme.borders.borderLineDisabled};
  width: 100%;
  margin: 24px 0;
`

interface Props extends HTMLAttributes<HTMLDivElement> {
  exchangeType: ExchangeType
  isOpen: boolean
  onBack: () => void
  onClose: () => void
  theme?: any
  fetchBalances: () => Promise<void>
  xDaiBalance: Maybe<BigNumber>
  mainnetTokens: Token[]
  xDaiTokens: Token[]
}

export const ModalDepositWithdraw = (props: Props) => {
  const { exchangeType, fetchBalances, isOpen, mainnetTokens, onBack, onClose, theme, xDaiBalance, xDaiTokens } = props

  const context = useConnectedWeb3Context()
  const cpk = context.cpk

  const [currencySelected, setCurrencySelected] = useState<KnownToken>('dai')

  const [displayFundAmount, setDisplayFundAmount] = useState<BigNumber>(new BigNumber(0))
  const [amountToDisplay, setAmountToDisplay] = useState<string>('')
  const [isTransactionModalOpen, setIsTransactionModalOpen] = useState<boolean>(false)

  const [txHash, setTxHash] = useState('')
  const [txState, setTxState] = useState<TransactionStep>(TransactionStep.waitingConfirmation)
  const [txNetId, setTxNetId] = useState()
  const [confirmations, setConfirmations] = useState(0)
  const [message, setMessage] = useState('')

  const [initiatedAllowanceState, setInitiatedAllowanceState] = useState<ButtonStates>(ButtonStates.idle)

  const { account, relay } = context.rawWeb3Context

  const findCurrentTokenBasedOnAction = (exchange: ExchangeType, symbol: string): Token | undefined => {
    if (exchange === ExchangeType.deposit) {
      return (
        mainnetTokens.find(
          token => token.symbol === (context.networkId === networkIds.XDAI && symbol === 'DAI' ? 'xDAI' : symbol),
        ) || mainnetTokens.find(token => token.symbol === symbol)
      )
    } else if (exchange === ExchangeType.withdraw && symbol === 'DAI') {
      const nativeAsset = getNativeAsset(networkIds.XDAI)

      return { ...nativeAsset, balance: xDaiBalance ? xDaiBalance.toString() : '0' }
    } else return xDaiTokens.find(token => token.symbol === (symbol === 'DAI' ? 'xDAI' : symbol))
  }
  const { address, balance, decimals, symbol } =
    findCurrentTokenBasedOnAction(exchangeType, currencySelected.toUpperCase()) ||
    getToken(context.relay ? networkIds.XDAI : context.networkId, 'dai')
  const currentTokenMainnet = mainnetTokens.find(element => element.symbol === symbol)

  const isApprovalVisible =
    (exchangeType === ExchangeType.deposit &&
      currentTokenMainnet &&
      new BigNumber(currentTokenMainnet.allowance ? currentTokenMainnet.allowance : '0').isZero() &&
      displayFundAmount.gte(currentTokenMainnet.allowance || Zero)) ||
    (exchangeType === ExchangeType.deposit &&
      initiatedAllowanceState === ButtonStates.finished &&
      currentTokenMainnet &&
      !new BigNumber(currentTokenMainnet.allowance ? currentTokenMainnet.allowance : '0').isZero())

  const approve = async () => {
    try {
      setInitiatedAllowanceState(ButtonStates.working)
      if (exchangeType === ExchangeType.deposit) {
        if (currencySelected === 'dai') {
          const collateralService = new ERC20Service(context.rawWeb3Context.library, account, address)

          await collateralService.approveUnlimited(DAI_TO_XDAI_TOKEN_BRIDGE_ADDRESS)
        } else {
          const collateralService = new ERC20Service(context.rawWeb3Context.library, account, address)

          await collateralService.approveUnlimited(OMNI_BRIDGE_MAINNET_ADDRESS)
        }
      }
      await fetchBalances()
      setInitiatedAllowanceState(ButtonStates.finished)
    } catch {
      setInitiatedAllowanceState(ButtonStates.idle)
    }
  }

  React.useEffect(() => {
    Modal.setAppElement('#root')
  }, [])

  useEffect(() => {
    setInitiatedAllowanceState(ButtonStates.idle)
    setDisplayFundAmount(Zero)
    setAmountToDisplay(' ')

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account, relay, exchangeType, currencySelected])

  const wallet = new BigNumber(balance ? balance : '0')

  const minDaiBridgeExchange = exchangeType === ExchangeType.deposit ? Zero : ethers.utils.parseUnits('10', decimals)
  const minOmniBridgeExchange = Zero

  const isDepositWithdrawDisabled =
    !wallet ||
    displayFundAmount.gt(wallet) ||
    displayFundAmount.isZero() ||
    displayFundAmount.lt(currencySelected === 'dai' ? minDaiBridgeExchange : minOmniBridgeExchange) ||
    (exchangeType === ExchangeType.deposit &&
      currentTokenMainnet &&
      currentTokenMainnet.allowance &&
      displayFundAmount.gt(new BigNumber(currentTokenMainnet.allowance))) ||
    (exchangeType === ExchangeType.withdraw && xDaiBalance?.isZero())

  const depositWithdraw = async () => {
    if (!cpk) {
      return
    }

    try {
      setMessage(`${exchangeType} ${formatBigNumber(displayFundAmount || new BigNumber(0), decimals)} ${symbol}`)
      setTxState(TransactionStep.waitingConfirmation)
      setConfirmations(0)
      setIsTransactionModalOpen(true)

      const hash =
        exchangeType === ExchangeType.deposit
          ? await cpk.sendMainnetTokenToBridge(displayFundAmount, address, symbol)
          : await cpk.sendXdaiChainTokenToBridge(
              displayFundAmount,
              address,
              {
                setTxState,
                setTxHash,
              },
              symbol,
            )

      const provider = exchangeType === ExchangeType.deposit ? context.rawWeb3Context.library : context.library

      setTxNetId(provider.network.chainId)
      setTxHash(hash)

      await waitForConfirmations(hash, provider, setConfirmations, setTxState, 13)

      if (exchangeType === ExchangeType.deposit && symbol !== 'DAI') {
        await XdaiService.waitForBridgeMessageStatus(hash, context.library)
      }
      if (exchangeType === ExchangeType.withdraw && symbol !== 'DAI') {
        await XdaiService.waitForClaimSignature(hash, context.library)
      }
      setTxState(TransactionStep.transactionConfirmed)
      await fetchBalances()
      setIsTransactionModalOpen(false)
      onBack()
      setDisplayFundAmount(new BigNumber(0))
      setAmountToDisplay('')
    } catch (e) {
      setTxState(TransactionStep.error)
    }
  }

  const bridgeItems = bridgeTokensList.map((item, index) => {
    const { address, decimals, name, symbol } = getToken(networkIds.MAINNET, item)

    const token = findCurrentTokenBasedOnAction(exchangeType, symbol)

    return (
      <BalanceItem
        hover
        key={index}
        onClick={() => {
          setCurrencySelected(item)
        }}
      >
        <BalanceItemSide>
          <RadioInput checked={currencySelected === item} name={item} outcomeIndex={-1} readOnly />
          <Image size={'24'} src={getImageUrl(address)} style={{ marginLeft: '12px', marginRight: '12px' }} />
          <BalanceItemTitle notSelected={currencySelected !== item}>
            {name ? name : symbol.toLowerCase()}
          </BalanceItemTitle>
        </BalanceItemSide>
        <BalanceItemSide>
          <BalanceItemBalance>
            {token?.balance
              ? formatBigNumber(new BigNumber(token?.balance), decimals, symbol === 'DAI' ? 2 : 3)
              : '0.00'}{' '}
            {symbol}
          </BalanceItemBalance>
        </BalanceItemSide>
      </BalanceItem>
    )
  })

  return (
    <>
      <Modal
        isOpen={isOpen && !isTransactionModalOpen}
        onRequestClose={onClose}
        shouldCloseOnOverlayClick={true}
        style={{
          ...theme.fluidHeightModal,
          content: { ...theme.fluidHeightModal.content, minHeight: '510px' },
        }}
      >
        <ContentWrapper>
          <ModalNavigation>
            <ModalNavigationLeft>
              <IconArrowBack
                hoverEffect={true}
                onClick={() => {
                  onBack()
                  setDisplayFundAmount(new BigNumber(0))
                  setAmountToDisplay('')
                }}
              />
              <ModalTitle style={{ marginLeft: '16px' }}>{exchangeType} Asset</ModalTitle>
            </ModalNavigationLeft>
            <IconClose
              hoverEffect={true}
              onClick={() => {
                onClose()
                setDisplayFundAmount(new BigNumber(0))
                setAmountToDisplay('')
              }}
            />
          </ModalNavigation>
          <ModalCard style={{ marginBottom: '20px', marginTop: '10px' }}>
            <BalanceSection>
              <WalletText>Wallet</WalletText>
              <BalanceItems>{bridgeItems}</BalanceItems>
            </BalanceSection>
          </ModalCard>
          <TextfieldCustomPlaceholder
            formField={
              <BigNumberInput
                decimals={decimals}
                name="amount"
                onChange={(e: BigNumberInputReturn) => {
                  setDisplayFundAmount(e.value)
                  setAmountToDisplay('')
                }}
                value={displayFundAmount}
                valueToDisplay={amountToDisplay}
              />
            }
            onClickMaxButton={() => {
              setDisplayFundAmount(wallet)
              setAmountToDisplay(formatBigNumber(wallet, decimals, 5))
            }}
            shouldDisplayMaxButton={true}
            symbol={symbol}
          />
          {exchangeType === ExchangeType.withdraw && currencySelected !== 'dai' && xDaiBalance?.isZero() ? (
            <InputInfo>
              <IconAlertInverted />
              <div style={{ marginLeft: '12px' }}>Fund your Omen Account with Dai to proceed with the withdrawal.</div>
            </InputInfo>
          ) : (
            <>
              <ExchangeDataItem style={{ marginTop: '24px' }}>
                <span>Min amount</span>
                <span>
                  {currencySelected === 'dai'
                    ? `${formatBigNumber(minDaiBridgeExchange, decimals, 2)} DAI`
                    : `${formatBigNumber(minOmniBridgeExchange, decimals, 3)} ${symbol}`}
                </span>
              </ExchangeDataItem>
              <ExchangeDataItem style={{ marginTop: '12px' }}>
                <div style={{ display: 'flex' }}>
                  {exchangeType === ExchangeType.withdraw ? 'Withdraw' : 'Deposit'} Fee
                  <div
                    data-arrow-color="transparent"
                    data-for="feeInfo"
                    data-tip={`Bridge Fee ${
                      currencySelected !== 'dai' && exchangeType === ExchangeType.withdraw ? '0.10%' : '0.00%'
                    }`}
                  >
                    <IconInfo hasCircle style={{ marginLeft: '8px', verticalAlign: 'bottom' }} />
                  </div>
                </div>
                <ReactTooltip
                  className="customMarketTooltip"
                  data-multiline={true}
                  effect="solid"
                  id="feeInfo"
                  offset={{ top: -5, left: 0 }}
                  place="top"
                  type="light"
                />

                <span>
                  {exchangeType === ExchangeType.withdraw && currencySelected !== 'dai'
                    ? `${formatNumber(formatBigNumber(displayFundAmount.div(1000), decimals, decimals), 3)} ${symbol}`
                    : `0.00 ${symbol}`}
                </span>
              </ExchangeDataItem>
              <Divider />
              <ExchangeDataItem>
                <span>Total</span>

                <span>
                  {currencySelected !== 'dai' && exchangeType === ExchangeType.withdraw
                    ? `${formatNumber(
                        formatBigNumber(displayFundAmount.sub(displayFundAmount.div(1000)), decimals, decimals),
                        3,
                      )} ${symbol}`
                    : `${formatNumber(formatBigNumber(displayFundAmount, decimals, decimals))} ${symbol}`}
                </span>
              </ExchangeDataItem>
            </>
          )}

          <BottomButtons>
            {isApprovalVisible && (
              <ApproveButton
                disabled={initiatedAllowanceState !== ButtonStates.idle}
                extraText
                onClick={approve}
                state={initiatedAllowanceState}
              >
                {initiatedAllowanceState === ButtonStates.idle && `Approve ${currencySelected.toUpperCase()}`}
                {initiatedAllowanceState === ButtonStates.working && 'Approving'}
                {initiatedAllowanceState === ButtonStates.finished && 'Approved'}
              </ApproveButton>
            )}

            <DepositWithdrawButton
              buttonType={ButtonType.primary}
              disabled={isDepositWithdrawDisabled}
              onClick={depositWithdraw}
            >
              {exchangeType}
            </DepositWithdrawButton>
          </BottomButtons>
        </ContentWrapper>
      </Modal>
      <ModalTransactionWrapper
        confirmations={confirmations}
        confirmationsRequired={13}
        icon={
          <Image
            size={'24'}
            src={getImageUrl(
              currentTokenMainnet && currentTokenMainnet.address ? currentTokenMainnet.address : address,
            )}
            style={{ marginLeft: '10px' }}
          />
        }
        isOpen={isTransactionModalOpen}
        message={message}
        netId={txNetId}
        onClose={() => {
          setIsTransactionModalOpen(false)
          onClose()
        }}
        txHash={txHash}
        txState={txState}
      />
    </>
  )
}

export const ModalDepositWithdrawWrapper = withTheme(ModalDepositWithdraw)
