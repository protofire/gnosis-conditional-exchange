import { BigNumber } from 'ethers/utils'
import React, { HTMLAttributes, useState } from 'react'
import Modal from 'react-modal'
import styled, { withTheme } from 'styled-components'

import { useConnectedWeb3Context } from '../../../hooks'
import { NetworkId, bridgeTokensList, getToken, networkIds } from '../../../util/networks'
import { getImageUrl } from '../../../util/token'
import { bigNumberToString, truncateStringInTheMiddle, waitForConfirmations } from '../../../util/tools'
import { KnownTokenValue, Token, TransactionStep } from '../../../util/types'
import { Button } from '../../button/button'
import { ButtonType } from '../../button/button_styling_types'
import { IconClose, IconMetaMask, IconWalletConnect } from '../../common/icons'
import { IconChevronDown } from '../../common/icons/IconChevronDown'
import { IconChevronUp } from '../../common/icons/IconChevronUp'
import { IconJazz } from '../../common/icons/IconJazz'
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
  ModalTitle,
} from '../common_styled'
import { ModalTransactionWrapper } from '../modal_transaction'

const TopCardHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  width: 100%;
  border-bottom: ${props => props.theme.borders.borderLineDisabled};
`

const TopCardHeaderLeft = styled.div`
  display: flex;
  align-items: center;
`

const ConnectionIconWrapper = styled.div`
  height: 28px;
  width: 28px;
  position: relative;
`

const ConnectorCircle = styled.div`
  height: 20px;
  width: 20px;
  border-radius: 50%;
  border: ${props => props.theme.borders.borderLineDisabled};
  background: #fff;
  z-index: 2;
  position: absolute;
  bottom: 0;
  right: -4px;
  display: flex;
  align-items: center;
  justify-content: center;
`

const AccountInfo = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-contect: space-between;
  margin-left: 12px;
`
const StrongText = styled.div`
  font-weight: 500;
  font-size: ${props => props.theme.fonts.defaultSize};
  line-height: 14.06px;
  color: ${props => props.theme.textfield.color};
  margin-bottom: 5px;
`

const ClaimLeft = styled.div`
  display: flex;
  flex-direction: column;
  align-self: center;
`
const ClaimLeftSvg = styled.div`
  display: flex;
  justify-content: space-between;
  flex: 1;
  cursor: pointer;
  &:hover {
    .chevronDown {
      path {
        fill: ${props => props.theme.colors.primaryLight};
      }
    }
  }
`

const AccountInfoAddress = styled.p`
  font-size: ${props => props.theme.fonts.defaultSize};
  color: ${props => props.theme.colors.textColorDark};
  margin: 0;
`

const AccountInfoWallet = styled.p`
  font-size: 12px;
  color: ${props => props.theme.colors.textColorLighter};
  margin: 0;
`

const CardHeaderText = styled.p`
  font-size: ${props => props.theme.fonts.defaultSize};
  color: ${props => props.theme.colors.textColorLighter};
  margin: 0;
`

const ClaimButton = styled(Button)`
  width: 72px;
`

const ChangeWalletButton = styled(Button)``

const DepositWithdrawButtons = styled.div`
  padding: 16px 20px;
  border-top: ${props => props.theme.borders.borderLineDisabled};
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
`

const DepositWithdrawButton = styled(Button)`
  width: calc(50% - 8px);
`

const SvgWrap = styled.div`
  align-self: center;
  padding-right: 22px;
`

const ConnectionModalNavigation = styled(ModalNavigation as any)`
  padding: 0;
  margin-bottom: 16px;
`

interface Props extends HTMLAttributes<HTMLDivElement> {
  changeWallet: () => void
  isOpen: boolean
  onClose: () => void
  openDepositModal: () => void
  openWithdrawModal: () => void
  theme?: any
  fetchBalances: () => void
  xOmenBalance: BigNumber
  xDaiBalance: BigNumber
  arrayOfClaimableBalances: KnownTokenValue[]
  xDaiTokens: any
  mainnetTokens: any
}

export const ModalYourConnection = (props: Props) => {
  const {
    arrayOfClaimableBalances,
    changeWallet,
    fetchBalances,
    isOpen,
    mainnetTokens,
    onClose,
    openDepositModal,
    openWithdrawModal,
    theme,
    xDaiBalance,
    xDaiTokens,
    xOmenBalance,
  } = props

  const context = useConnectedWeb3Context()
  const owner = context.rawWeb3Context.account

  const { cpk, relay } = context

  const [isTransactionModalOpen, setIsTransactionModalOpen] = useState<boolean>(false)
  const [txHash, setTxHash] = useState('')
  const [txState, setTxState] = useState<TransactionStep>(TransactionStep.waitingConfirmation)
  const [txNetId, setTxNetId] = useState()
  const [confirmations, setConfirmations] = useState(0)
  const [message, setMessage] = useState('')
  const [displayClaim, setDisplayClaim] = useState<boolean>(false)

  const claim = async () => {
    if (!cpk) {
      return
    }

    try {
      setMessage(
        `Claim ${arrayOfClaimableBalances
          .map(
            e =>
              `${bigNumberToString(
                e.value,
                getToken(networkIds.MAINNET, e.token).decimals,
              )}${' '}${e.token.toUpperCase()}`,
          )
          .join(', ')}`,
      )
      setTxState(TransactionStep.waitingConfirmation)
      setConfirmations(0)
      setIsTransactionModalOpen(true)

      const transaction = await cpk.claimAllTokens()

      const provider = context.rawWeb3Context.library
      setTxNetId(provider.network.chainId)
      setTxHash(transaction.hash)

      await waitForConfirmations(transaction.hash, provider, setConfirmations, setTxState, 1)
      setTxState(TransactionStep.transactionConfirmed)
      await fetchBalances()
    } catch (e) {
      setTxState(TransactionStep.error)
    }
  }

  const DAI = getToken(1, 'dai')

  const claimableItems = arrayOfClaimableBalances.map((item, index) => {
    const { token, value } = item
    const { address, decimals, name } = getToken(networkIds.MAINNET, token)

    return (
      <BalanceItem key={index + token}>
        <BalanceItemSide>
          <Image size={'24'} src={getImageUrl(address)} />
          <BalanceItemTitle style={{ marginLeft: '4px' }}>{name ? name : token}</BalanceItemTitle>
        </BalanceItemSide>
        <BalanceItemBalance>
          {bigNumberToString(value, decimals)} {token.toUpperCase()}
        </BalanceItemBalance>
      </BalanceItem>
    )
  })
  const tokenBalances = (forNetwork: NetworkId) => {
    return bridgeTokensList.map((token, index) => {
      const { address, decimals, name, symbol } = getToken(networkIds.MAINNET, token)
      let balance
      if (forNetwork === networkIds.MAINNET)
        balance = new BigNumber(mainnetTokens.filter((token: Token) => token.symbol === symbol)[0]?.balance || '')
      else if (forNetwork === networkIds.XDAI && symbol === 'DAI') {
        balance = new BigNumber(xDaiBalance)
      } else balance = new BigNumber(xDaiTokens.filter((token: Token) => token.symbol === symbol)[0]?.balance || '')

      return (
        <BalanceItem key={index + address}>
          <BalanceItemSide>
            <Image size={'24'} src={getImageUrl(address)} />
            <BalanceItemTitle style={{ marginLeft: '12px' }}>{name ? name : symbol}</BalanceItemTitle>
          </BalanceItemSide>
          <BalanceItemBalance>
            {bigNumberToString(balance, decimals, symbol === 'DAI' ? 2 : 3)} {symbol}
          </BalanceItemBalance>
        </BalanceItem>
      )
    })
  }

  React.useEffect(() => {
    Modal.setAppElement('#root')
  }, [])

  const connectorIcon =
    context.rawWeb3Context.connectorName === 'MetaMask' ? (
      <IconMetaMask />
    ) : context.rawWeb3Context.connectorName === 'WalletConnect' ? (
      <IconWalletConnect />
    ) : (
      <></>
    )

  return (
    <>
      <Modal
        isOpen={isOpen && !isTransactionModalOpen}
        onRequestClose={onClose}
        shouldCloseOnOverlayClick={true}
        style={theme.fluidHeightModal}
      >
        <ContentWrapper>
          <ConnectionModalNavigation>
            <ModalTitle>Your Connection</ModalTitle>
            <IconClose hoverEffect={true} onClick={onClose} />
          </ConnectionModalNavigation>
          <ModalCard>
            <TopCardHeader>
              <TopCardHeaderLeft>
                <ConnectionIconWrapper>
                  <ConnectorCircle>{connectorIcon}</ConnectorCircle>
                  <IconJazz account={owner || ''} size={28} />
                </ConnectionIconWrapper>
                <AccountInfo>
                  <AccountInfoAddress>{truncateStringInTheMiddle(owner || '', 5, 3)}</AccountInfoAddress>
                  <AccountInfoWallet>{context.rawWeb3Context.connectorName}</AccountInfoWallet>
                </AccountInfo>
              </TopCardHeaderLeft>
              <ChangeWalletButton buttonType={ButtonType.secondaryLine} onClick={changeWallet}>
                Change
              </ChangeWalletButton>
            </TopCardHeader>
            <BalanceSection>
              <CardHeaderText>Wallet</CardHeaderText>
              <BalanceItems style={{ marginTop: '14px' }}>{tokenBalances(networkIds.MAINNET)}</BalanceItems>
            </BalanceSection>
          </ModalCard>
          {relay && arrayOfClaimableBalances.length !== 0 && (
            <ModalCard>
              <BalanceSection borderBottom={displayClaim} style={{ flexDirection: 'row' }}>
                <ClaimLeftSvg
                  onClick={() => {
                    setDisplayClaim(!displayClaim)
                  }}
                >
                  <ClaimLeft>
                    <StrongText>Claimable Assets</StrongText>

                    <BalanceItemBalance as="div">
                      {arrayOfClaimableBalances.map(e => e.token.toUpperCase()).join(', ')}
                    </BalanceItemBalance>
                  </ClaimLeft>
                  <SvgWrap>
                    {displayClaim ? <IconChevronUp /> : <IconChevronDown color={theme.colors.tertiary} />}
                  </SvgWrap>
                </ClaimLeftSvg>

                <ClaimButton buttonType={ButtonType.primary} onClick={claim}>
                  Claim
                </ClaimButton>
              </BalanceSection>

              {displayClaim && <BalanceSection>{claimableItems}</BalanceSection>}
            </ModalCard>
          )}
          {relay && (
            <ModalCard>
              <>
                <BalanceSection>
                  <CardHeaderText>Omen Account</CardHeaderText>
                  <BalanceItems style={{ marginTop: '14px' }}>{tokenBalances(networkIds.XDAI)}</BalanceItems>
                </BalanceSection>
                <DepositWithdrawButtons>
                  <DepositWithdrawButton buttonType={ButtonType.secondaryLine} onClick={openDepositModal}>
                    Deposit
                  </DepositWithdrawButton>
                  <DepositWithdrawButton
                    buttonType={ButtonType.secondaryLine}
                    disabled={xOmenBalance.isZero() && xDaiBalance.isZero()}
                    onClick={openWithdrawModal}
                  >
                    Withdraw
                  </DepositWithdrawButton>
                </DepositWithdrawButtons>
              </>
            </ModalCard>
          )}
        </ContentWrapper>
      </Modal>
      <ModalTransactionWrapper
        confirmations={confirmations}
        confirmationsRequired={1}
        icon={message.includes('Enable') && DAI.image}
        isOpen={isTransactionModalOpen}
        message={message}
        netId={txNetId}
        onClose={() => setIsTransactionModalOpen(false)}
        txHash={txHash}
        txState={txState}
      />
    </>
  )
}

export const ModalYourConnectionWrapper = withTheme(ModalYourConnection)
