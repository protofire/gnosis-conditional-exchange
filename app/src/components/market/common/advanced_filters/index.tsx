import React from 'react'
import styled from 'styled-components'

import { useConnectedWeb3Context } from '../../../../contexts/connectedWeb3'
import { getArbitratorsByNetwork, getNativeAsset, getWrapToken } from '../../../../util/networks'
import { CurationSource } from '../../../../util/types'
import { Dropdown, DropdownItemProps, DropdownPosition } from '../../../common/form/dropdown'
import { IconDxDao, IconKleros } from '../../../common/icons'
import { CurrencySelector } from '../../common/currency_selector'

const Wrapper = styled.div`
  column-gap: 20px;
  display: grid;
  grid-template-columns: 1fr;
  margin: 0 24px;
  margin-bottom: 24px;
  row-gap: 20px;

  @media (min-width: ${props => props.theme.themeBreakPoints.md}) {
    grid-template-columns: 1fr 1fr 1fr;
  }
`

const LogoWrapper = styled.div`
  margin-right: 6px;
`

const CurationSourceWrapper = styled.div`
  display: flex;
  align-items: center;
`

const Column = styled.div`
  @media (min-width: ${props => props.theme.themeBreakPoints.md}) {
    max-width: 165px;
  }
`

const TitleWrapper = styled.div`
  margin: 0 0 12px;
  display: flex;
  justify-content: space-between;
  align-items: center;
`

const Title = styled.h2`
  color: ${props => props.theme.colors.textColorDark};
  font-size: ${({ theme }) => theme.fonts.defaultSize};
  font-weight: normal;
  line-height: 1.2;
  margin: 0;
`

const ClearLabel = styled.span`
  color: ${props => props.theme.colors.clickable};
  font-size: ${({ theme }) => theme.fonts.defaultSize};
  font-weight: normal;
  line-height: 1.2;
  cursor: pointer;
  &:hover {
    color: ${props => props.theme.colors.primaryLight};
  }
`

const Options = styled(Dropdown)`
  max-width: 100%;
`

interface Props {
  currency: Maybe<string>
  arbitrator: Maybe<string>
  curationSource: CurationSource
  onChangeCurrency: (currency: Maybe<string> | null) => void
  onChangeArbitrator: (arbitrator: Maybe<string>) => void
  onChangeCurationSource: (curationSource: CurationSource) => void
  onChangeTemplateId: (templateId: Maybe<string>) => void
  disableCurationFilter: Maybe<boolean>
}

export const AdvancedFilters = (props: Props) => {
  const context = useConnectedWeb3Context()
  const { networkId } = context

  const arbitrators = getArbitratorsByNetwork(networkId)

  const {
    arbitrator,
    curationSource,
    currency,
    disableCurationFilter,
    onChangeArbitrator,
    onChangeCurationSource,
    onChangeCurrency,
    onChangeTemplateId,
  } = props

  const questionTypeOptions: Array<DropdownItemProps> = [
    {
      content: 'All',
      onClick: () => onChangeTemplateId(null),
    },
    {
      content: 'Binary',
      onClick: () => onChangeTemplateId('0'),
    },
    {
      content: 'Categorical',
      onClick: () => onChangeTemplateId('2'),
    },
  ]

  const arbitratorOptions: Array<DropdownItemProps> = [
    { address: null, name: 'All', isSelectionEnabled: true },
    ...arbitrators,
  ]
    .filter(item => {
      return item.isSelectionEnabled
    })
    .map(({ address, name }) => {
      if (name === CurationSource.KLEROS) {
        return {
          content: (
            <CurationSourceWrapper>
              <LogoWrapper>
                <IconKleros id="arbitrator" />
              </LogoWrapper>
              {name}
            </CurationSourceWrapper>
          ),
          onClick: () => onChangeArbitrator(address),
        }
      }
      return {
        content: name,
        onClick: () => onChangeArbitrator(address),
      }
    })

  const curationSourceOptions: Array<DropdownItemProps> = [
    {
      content: CurationSource.ALL_SOURCES,
      onClick: () => onChangeCurationSource(CurationSource.ALL_SOURCES),
    },
    {
      content: (
        <CurationSourceWrapper>
          <LogoWrapper>
            <IconDxDao />
          </LogoWrapper>
          {CurationSource.DXDAO}
        </CurationSourceWrapper>
      ),
      onClick: () => onChangeCurationSource(CurationSource.DXDAO),
    },
    {
      content: (
        <CurationSourceWrapper>
          <LogoWrapper>
            <IconKleros id="verify" />
          </LogoWrapper>
          {CurationSource.KLEROS}
        </CurationSourceWrapper>
      ),
      onClick: () => onChangeCurationSource(CurationSource.KLEROS),
    },
    {
      content: CurationSource.NO_SOURCES,
      onClick: () => onChangeCurationSource(CurationSource.NO_SOURCES),
    },
  ]

  const showQuestionType = false

  const activeArbitratorIndex = arbitrators.findIndex(t => t.address === arbitrator) + 1

  const nativeAssetAddress = getNativeAsset(context.networkId, context.relay).address.toLowerCase()
  const wrapTokenAddress = getWrapToken(context.networkId).address.toLowerCase()
  const filter = [wrapTokenAddress]

  return (
    <Wrapper>
      <Column>
        <TitleWrapper>
          <Title>Currency</Title>
          {currency && <ClearLabel onClick={() => onChangeCurrency(null)}>Clear</ClearLabel>}
        </TitleWrapper>

        <CurrencySelector
          addAll
          addNativeAsset
          context={context}
          currency={currency}
          disabled={false}
          filters={filter}
          negativeFilter
          onSelect={currency =>
            onChangeCurrency(
              currency
                ? currency.address.toLowerCase() === nativeAssetAddress
                  ? wrapTokenAddress
                  : currency.address
                : null,
            )
          }
          placeholder={currency ? '' : 'All'}
        />
      </Column>

      {showQuestionType && (
        <Column>
          <TitleWrapper>
            <Title>Question Type</Title>
          </TitleWrapper>

          <Options items={questionTypeOptions} />
        </Column>
      )}
      <Column>
        <TitleWrapper>
          <Title>Arbitrator</Title>
          {arbitrator && <ClearLabel onClick={() => onChangeArbitrator(null)}>Clear</ClearLabel>}
        </TitleWrapper>
        <Options
          currentItem={activeArbitratorIndex}
          dirty={true}
          dropdownPosition={DropdownPosition.center}
          items={arbitratorOptions}
        />
      </Column>
      {!disableCurationFilter && (
        <Column>
          <TitleWrapper>
            <Title>Verified by</Title>
            {curationSource !== CurationSource.ALL_SOURCES && (
              <ClearLabel onClick={() => onChangeCurationSource(CurationSource.ALL_SOURCES)}>Clear</ClearLabel>
            )}
          </TitleWrapper>

          <Options
            currentItem={[
              CurationSource.ALL_SOURCES,
              CurationSource.DXDAO,
              CurationSource.KLEROS,
              CurationSource.NO_SOURCES,
            ].findIndex(t => t === curationSource)}
            dirty={true}
            dropdownPosition={DropdownPosition.center}
            items={curationSourceOptions}
          />
        </Column>
      )}
    </Wrapper>
  )
}
