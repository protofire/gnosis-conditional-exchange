import React, { DOMAttributes } from 'react'
import ReactTooltip from 'react-tooltip'
import styled from 'styled-components'

import { useRealityLink } from '../../../../hooks/useRealityLink'
import { Arbitrator } from '../../../../util/types'
import { IconAlert, IconArbitrator, IconCategory, IconOracle, IconVerified } from '../../../common/icons'

const AdditionalMarketDataWrapper = styled.div`
  border-top: 1px solid ${props => props.theme.borders.borderDisabled};
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-left: -26px;
  width: ${props => props.theme.mainContainer.maxWidth};

  @media (max-width: ${props => props.theme.themeBreakPoints.md}) {
    flex-direction: column;
    width: calc(100% + 26px * 2);
    height: auto;
    border-top: none;
  }
`

const AdditionalMarketDataLeft = styled.div`
  display: flex;
  align-items: center;
  padding: 14px 20px;

  & > * + * {
    margin-left: 14px;
  }
  @media (max-width: ${props => props.theme.themeBreakPoints.md}) {
    flex-wrap: wrap !important;
    justify-content: space-between !important;
    width: 100%;
    padding: 14px 24px;
    & > * {
      margin: 0 !important;
      width: 48% !important;
      margin-top: 5px !important;
    }
  }
`

const AdditionalMarketDataSectionTitle = styled.p<{ isError?: boolean }>`
  margin: 0;
  margin-left: 8px;
  font-size: ${props => props.theme.textfield.fontSize};
  line-height: 16px;
  white-space: nowrap;
  color: ${({ isError, theme }) => (isError ? theme.colors.alert : theme.colors.clickable)};
  &:first-letter {
    text-transform: capitalize;
  }
`

const AdditionalMarketDataSectionDivWrapper = styled.div`
  display: flex;
  align-items: center;
  cursor: pointer;
`

const AdditionalMarketDataSectionWrapper = styled.a<{ noColorChange?: boolean }>`
  display: flex;
  align-items: center;
  cursor: pointer;

  &:hover {
    p {
      color: ${props => props.theme.colors.primaryLight};
    }
    svg {
      circle {
        stroke: ${props => props.theme.colors.primaryLight};
      }
      path {
        fill: ${props => (props.noColorChange ? '' : props.theme.colors.primaryLight)};
      }

      path:nth-child(even) {
        fill: ${props => props.theme.colors.primaryLight};
      }
    }
  }
  @media (max-width: ${props => props.theme.themeBreakPoints.md}) {
    margin-left: 11px;
    &:nth-of-type(1) {
      margin-left: 0;
    }
  }
`

interface Props extends DOMAttributes<HTMLDivElement> {
  category: string
  arbitrator: Arbitrator
  oracle: string
  id: string
  verified: boolean
}

export const AdditionalMarketData: React.FC<Props> = props => {
  const { arbitrator, category, id, oracle, verified } = props
  const realitioBaseUrl = useRealityLink()

  const realitioUrl = id ? `${realitioBaseUrl}/app/#!/question/${id}` : `${realitioBaseUrl}/`

  const isMobile = window.innerWidth < 768

  return (
    <AdditionalMarketDataWrapper>
      <AdditionalMarketDataLeft>
        <AdditionalMarketDataSectionWrapper href={`/#/24h-volume/category/${encodeURI(category)}`} noColorChange={true}>
          <IconCategory size={isMobile ? '20' : '24'} />
          <AdditionalMarketDataSectionTitle>{category}</AdditionalMarketDataSectionTitle>
        </AdditionalMarketDataSectionWrapper>
        <AdditionalMarketDataSectionWrapper
          data-arrow-color="transparent"
          data-tip={`This market uses the ${oracle} oracle which crowd-sources the correct outcome.`}
          href={realitioUrl}
          rel="noopener noreferrer"
          target="_blank"
        >
          <IconOracle size={isMobile ? '20' : '24'} />
          <AdditionalMarketDataSectionTitle>{oracle}</AdditionalMarketDataSectionTitle>
        </AdditionalMarketDataSectionWrapper>
        <AdditionalMarketDataSectionWrapper
          data-arrow-color="transparent"
          data-tip={`This market uses ${arbitrator.name} as the final arbitrator.`}
          href={arbitrator.url}
          rel="noopener noreferrer"
          target="_blank"
        >
          <IconArbitrator size={isMobile ? '20' : '24'} />
          <AdditionalMarketDataSectionTitle>{arbitrator.name}</AdditionalMarketDataSectionTitle>
        </AdditionalMarketDataSectionWrapper>
        <AdditionalMarketDataSectionDivWrapper>
          {verified ? <IconVerified size={isMobile ? '20' : '24'} /> : <IconAlert size={isMobile ? '20' : '24'} />}
          <AdditionalMarketDataSectionTitle isError={!verified}>
            {verified ? 'Verified' : 'Not Verified'}
          </AdditionalMarketDataSectionTitle>
        </AdditionalMarketDataSectionDivWrapper>
      </AdditionalMarketDataLeft>
      <ReactTooltip
        className="customMarketTooltip"
        data-multiline={true}
        effect="solid"
        offset={{ top: 0 }}
        place="top"
        type="light"
      />
    </AdditionalMarketDataWrapper>
  )
}
