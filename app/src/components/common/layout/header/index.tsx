import React, { useState } from 'react'
import { withRouter } from 'react-router'
import { matchPath } from 'react-router-dom'
import ReactTooltip from 'react-tooltip'
import styled, { css } from 'styled-components'

import { Network } from '../..'
import { Logo, STANDARD_DECIMALS } from '../../../../common/constants'
import { useConnectedWeb3Context } from '../../../../hooks'
import { networkIds } from '../../../../util/networks'
import { bigNumberToString } from '../../../../util/tools'
import { ExchangeType } from '../../../../util/types'
import { Button, ButtonCircle, ButtonRound } from '../../../button'
import { ButtonType } from '../../../button/button_styling_types'
import { ModalConnectWalletWrapper, ModalDepositWithdrawWrapper, ModalYourConnectionWrapper } from '../../../modal'
import { Dropdown, DropdownItemProps, DropdownPosition } from '../../form/dropdown'
import { IconAdd, IconClose, IconOmen } from '../../icons'
import { IconSettings } from '../../icons/IconSettings'

export const HeaderWrapper = styled.div`
  align-items: center;
  background: ${props => props.theme.header.backgroundColor};
  display: flex;
  flex-grow: 0;
  flex-shrink: 0;
  height: 88px;
  padding: 0 30px;
  justify-content: space-between;
  position: sticky;
  top: 0;
  z-index: 5;
  border-bottom: 1px solid ${props => props.theme.buttonPrimaryLine.borderColorDisabled};
`

export const HeaderInner = styled.div`
  align-items: center;
  display: flex;
  flex-direction: row;
  height: 100%;
  justify-content: space-between;
  margin: 0 auto;
  max-width: 100%;
  padding: 24px 0px;
  position: relative;
  width: ${props => props.theme.themeBreakPoints.xxl};
`

export const LogoWrapper = styled.a<{ disabled?: boolean }>`
  max-width: 90px;
  min-width: fit-content;
  ${props => (props.disabled ? 'pointer-events:none;' : '')};

  &:hover {
    cursor: pointer;
  }
`

const ButtonCreateDesktop = styled(ButtonRound)`
  display: none;

  @media (min-width: ${props => props.theme.themeBreakPoints.md}) {
    display: flex;
  }
`

const ButtonCreateMobile = styled(ButtonCircle)`
  display: flex;
  margin-left: auto;

  @media (min-width: ${props => props.theme.themeBreakPoints.md}) {
    display: none;
  }
`

const ButtonCSS = css`
  margin: 0 0 0 5px;
  padding: 12px 14px;
  @media (min-width: ${props => props.theme.themeBreakPoints.md}) {
    margin-left: 12px;

    &:first-child {
      margin-left: 0;
    }
  }
`

const ButtonConnectWalletStyled = styled(Button)`
  margin-left: 12px;
`

export const ButtonSettings = styled(ButtonRound)`
  @media (min-width: ${props => props.theme.themeBreakPoints.md}) {
    margin-left: 12px;
    width: 40px;
    height: 40px;
    padding: 0;
  }
`

export const ContentsLeft = styled.div`
  align-items: center;
  display: flex;
  margin: auto auto auto 0;
`

export const ContentsRight = styled.div`
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  margin: auto 0 auto auto;

  @media (min-width: ${props => props.theme.themeBreakPoints.md}) {
    margin: auto 0 0 auto;
    flex-wrap: unset;
  }
`

const HeaderButton = styled(ButtonRound)`
  ${ButtonCSS};
  color: ${props => props.theme.colors.textColorLighter};
`

const DepositedBalance = styled.p`
  font-size: ${props => props.theme.fonts.defaultSize};
  color: ${props => props.theme.colors.textColorLighter};
`

const HeaderButtonDivider = styled.div`
  height: 16px;
  width: 1px;
  margin: 0 12px;
  background: ${props => props.theme.borders.borderDisabled};
`

const CloseIconWrapper = styled.div`
  margin-right: 12px;
`

const DropdownWrapper = styled.div`
  display: flex;
  width: 100%;
  justify-content: space-between;
`

const Dot = styled.div<{ color: string; size: number }>`
  height: ${props => props.size}px;
  width: ${props => props.size}px;
  background-color: ${props => props.theme.colors[props.color]};
  border-radius: 50%;
  display: inline-block;
  margin-right: 8px;
`

const DropdownText = styled.div`
  display: flex;
  align-items: center;
`

const HeaderDropdown = styled(Dropdown)`
  ${ButtonCSS};
  height: 40px;
`

const MarketAndGovernanceNav = styled.div<{ disabled?: boolean }>`
  display: none;
  background-color: ${props => (props.disabled ? props => props.theme.buttonSecondary.backgroundColor : 'transparent')};
  ${props => (props.disabled ? 'pointer-events:none;' : '')};
  border-radius: 32px;
  color: ${props => (!props.disabled ? props.theme.colors.clickable : props.theme.colors.primary)};
  cursor: pointer;
  font-weight: ${props => props.theme.textfield.fontWeight};
  letter-spacing: 1px;
  line-height: 16.41px;
  font-size: ${props => props.theme.fonts.defaultSize};
  text-align: center;
  padding: ${props => props.theme.textfield.paddingVertical} ${props => props.theme.textfield.paddingHorizontal};
  &:hover {
    color: ${props => (!props.disabled ? props.theme.colors.primary : '')};
  }
`
const OmenIconWrapper = styled.div`
  margin-left: 12px;
`

const HeaderContainer: React.FC = (props: any) => {
  const context = useConnectedWeb3Context()
  const { relay, toggleRelay } = context
  const { account, active, connectorName, error, networkId } = context.rawWeb3Context

  const { history, ...restProps } = props
  const [isConnectWalletModalOpen, setConnectWalletModalState] = useState(false)
  const [isYourConnectionModalOpen, setYourConnectionModalState] = useState(false)
  const [isDepositWithdrawModalOpen, setDepositWithdrawModalState] = useState(false)
  const [depositWithdrawType, setDepositWithdrawType] = useState<ExchangeType>(ExchangeType.deposit)
  const [marketPage, setMarketPage] = useState(true)

  const hasRouter = props.history !== undefined
  const disableConnectButton = isConnectWalletModalOpen

  const {
    arrayOfClaimableTokenBalances,
    fetchBalances,
    formattedNativeBalance,
    formattedxDaiBalance,
    mainnetTokens,
    omenBalance,
    xDaiBalance,
    xDaiTokens,
    xOmenBalance,
  } = context.balances

  const networkPlacholder = (
    <DropdownWrapper>
      <DropdownText>
        <Dot color="greenLight" size={8} />
        {relay ? 'xDai' : 'Mainnet'}
      </DropdownText>
    </DropdownWrapper>
  )

  const toggle = () => {
    toggleRelay()
    if (hasRouter) {
      history.replace('/')
    }
  }

  const networkDropdownItems: Array<DropdownItemProps> = [
    {
      onClick: toggle,
      content: (
        <DropdownWrapper>
          <DropdownText>{relay ? 'Mainnet' : 'xDai'}</DropdownText>
        </DropdownWrapper>
      ),
    },
  ]

  const logout = () => {
    if (active || (error && connectorName)) {
      localStorage.removeItem('CONNECTOR')
      if (context.rawWeb3Context.connectorName === 'WalletConnect') {
        localStorage.removeItem('walletconnect')
        context.rawWeb3Context.connector.onDeactivation()
      }
      context.rawWeb3Context.setConnector('Infura')
    }
  }

  const isMarketCreatePage = history ? !!matchPath(history.location.pathname, { path: '/create', exact: true }) : false

  const createButtonProps = {
    disabled: disableConnectButton || isMarketCreatePage || !hasRouter,
    onClick: () => history && history.push('/create'),
  }

  const exitButtonProps = {
    onClick: () => history && history.push('/'),
  }

  return (
    <HeaderWrapper {...restProps}>
      <HeaderInner>
        <ContentsLeft>
          <LogoWrapper disabled={!hasRouter} href={'/#/liquidity'}>
            <Logo />
          </LogoWrapper>
          <MarketAndGovernanceNav
            disabled={marketPage}
            onClick={() => {
              setMarketPage(!marketPage)
            }}
            style={{ marginLeft: '48px' }}
          >
            Markets
          </MarketAndGovernanceNav>
          <MarketAndGovernanceNav
            disabled={!marketPage}
            onClick={() => {
              setMarketPage(!marketPage)
            }}
          >
            Governance
          </MarketAndGovernanceNav>
        </ContentsLeft>
        <ContentsRight>
          {isMarketCreatePage ? (
            <>
              <ButtonCreateDesktop {...exitButtonProps}>
                <CloseIconWrapper>
                  <IconClose />
                </CloseIconWrapper>

                <span>Exit</span>
              </ButtonCreateDesktop>
              <ButtonCreateMobile {...exitButtonProps}>
                <IconClose />
              </ButtonCreateMobile>
            </>
          ) : (
            <>
              <ButtonCreateDesktop {...createButtonProps}>Create Market</ButtonCreateDesktop>
              <ButtonCreateMobile {...createButtonProps}>
                <IconAdd />
              </ButtonCreateMobile>
            </>
          )}

          {((networkId === networkIds.MAINNET && context.rawWeb3Context.connectorName !== 'Safe') || relay) && (
            <HeaderDropdown
              currentItem={networkDropdownItems.length + 1}
              disableDirty
              dropdownPosition={DropdownPosition.center}
              items={networkDropdownItems}
              minWidth={false}
              placeholder={networkPlacholder}
            />
          )}

          {account && (
            <HeaderButton style={{ display: 'none' }}>
              {relay
                ? `${bigNumberToString(xOmenBalance, STANDARD_DECIMALS, 0)}`
                : `${bigNumberToString(omenBalance, STANDARD_DECIMALS, 0)}`}
              <OmenIconWrapper>
                <IconOmen size={24} />
              </OmenIconWrapper>
            </HeaderButton>
          )}

          {!account && (
            <ButtonConnectWalletStyled
              buttonType={ButtonType.primary}
              disabled={disableConnectButton || !hasRouter || isConnectWalletModalOpen}
              onClick={() => {
                setConnectWalletModalState(true)
              }}
            >
              {isConnectWalletModalOpen ? 'Connecting' : 'Connect'}
            </ButtonConnectWalletStyled>
          )}
          {disableConnectButton && <ReactTooltip id="connectButtonTooltip" />}

          {account && (
            <HeaderButton
              onClick={() => {
                setYourConnectionModalState(true)
              }}
            >
              <>
                <DepositedBalance>
                  {relay
                    ? `${formattedxDaiBalance} DAI`
                    : context.rawWeb3Context.networkId === networkIds.XDAI
                    ? `${formattedNativeBalance} xDAI`
                    : `${formattedNativeBalance} ETH`}
                </DepositedBalance>
                <HeaderButtonDivider />
              </>
              <Network claim={false} />
            </HeaderButton>
          )}
          <ButtonSettings
            disabled={!hasRouter}
            {...exitButtonProps}
            onClick={() => history && history.push('/settings')}
          >
            <IconSettings />
          </ButtonSettings>
        </ContentsRight>
        <ModalYourConnectionWrapper
          arrayOfClaimableBalances={arrayOfClaimableTokenBalances}
          changeWallet={() => {
            setYourConnectionModalState(false)
            logout()
            setConnectWalletModalState(true)
          }}
          fetchBalances={fetchBalances}
          isOpen={isYourConnectionModalOpen && !isDepositWithdrawModalOpen}
          mainnetTokens={mainnetTokens}
          onClose={() => setYourConnectionModalState(false)}
          openDepositModal={() => {
            setYourConnectionModalState(false)
            setDepositWithdrawType(ExchangeType.deposit)
            setDepositWithdrawModalState(true)
          }}
          openWithdrawModal={() => {
            setYourConnectionModalState(false)
            setDepositWithdrawType(ExchangeType.withdraw)
            setDepositWithdrawModalState(true)
          }}
          xDaiBalance={xDaiBalance}
          xDaiTokens={xDaiTokens}
          xOmenBalance={xOmenBalance}
        />
        <ModalConnectWalletWrapper
          isOpen={isConnectWalletModalOpen}
          onClose={() => setConnectWalletModalState(false)}
        />
        <ModalDepositWithdrawWrapper
          exchangeType={depositWithdrawType}
          fetchBalances={fetchBalances}
          isOpen={isDepositWithdrawModalOpen}
          mainnetTokens={mainnetTokens}
          onBack={() => {
            setDepositWithdrawModalState(false)
            setYourConnectionModalState(true)
          }}
          onClose={() => setDepositWithdrawModalState(false)}
          xDaiBalance={xDaiBalance}
          xDaiTokens={xDaiTokens}
        />
      </HeaderInner>
    </HeaderWrapper>
  )
}

export const Header = withRouter(HeaderContainer)
export const HeaderNoRouter = HeaderContainer
