import React, { useEffect, useState } from 'react'
import Box from '3box'
import ThreeBoxCommentsReact from '3box-comments-react'
import styled from 'styled-components'
import { ConnectedWeb3Context, useConnectedWeb3Context } from '../../../hooks/connectedWeb3'
import { THREEBOX_ADMIN_ADDRESS, THREEBOX_SPACE_NAME } from '../../../common/constants'
import { getLogger } from '../../../util/logger'
import { ButtonCSS } from '../../../common/button_styling_types'

const logger = getLogger('Component::ThreeBoxComments')

const MAIN_AVATAR_DIMENSIONS = '40px'
const COMMENT_AVATAR_DIMENSIONS = '32px'

const CommentsTitle = styled.h3`
  color: #000;
  font-size: 18px;
  font-weight: 500;
  line-height: 1.2;
  margin: 0 0 20px;
`

const ThreeBoxCustom = styled.div`
  margin: 30px auto;
  max-width: ${props => props.theme.viewMarket.maxWidth};
  width: 100%;

  > .threebox-comments-react {
    max-width: 100%;
    padding: 0;

    /* Main comment area */
    .input {
      img {
        height: ${MAIN_AVATAR_DIMENSIONS};
        max-height: ${MAIN_AVATAR_DIMENSIONS};
        max-width: ${MAIN_AVATAR_DIMENSIONS};
        min-height: ${MAIN_AVATAR_DIMENSIONS};
        min-width: ${MAIN_AVATAR_DIMENSIONS};
        width: ${MAIN_AVATAR_DIMENSIONS};
      }

      .input_form {
        color: ${props => props.theme.colors.textColor};
        font-size: 13px;
        font-weight: normal;
        height: 54px;
        line-height: 1.2;
        min-height: 54px;
        padding: 5px 12px 5px 60px;
      }

      .input_commentAs {
        color: ${props => props.theme.colors.textColorLight};
        left: auto;
        margin: 0;
        right: 0;
        top: -40px;
      }

      .sc-user-input--picker-wrapper {
        max-height: 100%;
        min-height: 44px;
        min-width: 44px;
      }
    }

    /* Comments list */
    .dialogue {
      .dialogue_grid {
        display: block;
        margin-bottom: 0;
        row-gap: 30px;
      }

      /* Comment */
      .comment {
        border-bottom: 1px solid ${props => props.theme.borders.borderColor};
        padding: 15px 8px;

        &:first-child {
          border-top: 1px solid ${props => props.theme.borders.borderColor};
        }

        img {
          height: ${COMMENT_AVATAR_DIMENSIONS};
          max-height: ${COMMENT_AVATAR_DIMENSIONS};
          max-width: ${COMMENT_AVATAR_DIMENSIONS};
          min-height: ${COMMENT_AVATAR_DIMENSIONS};
          min-width: ${COMMENT_AVATAR_DIMENSIONS};
          width: ${COMMENT_AVATAR_DIMENSIONS};
        }

        .comment_content_context_main_user_info {
          margin-bottom: 0;
        }

        .comment_content_context_main_user_info_username {
          color: #000;
          font-size: 16px;
          font-weight: 400;
          line-height: 1.2;
        }

        .comment_content_context_main_user_info_address {
          color: ${props => props.theme.colors.textColorLight};
          font-size: 13px;
          font-weight: normal;
          line-height: 1.2;

          &::before {
            content: '(';
          }

          &::after {
            content: ')';
          }
        }

        .comment_content_context {
          margin: 0;
        }

        .comment_content_context_time {
          color: ${props => props.theme.colors.textColorLight};
          font-size: 11px;
          font-weight: normal;
          line-height: 1.36;
        }

        .comment_content_text {
          color: #000;
          font-size: 13px;
          font-weight: normal;
          line-height: 1.33;
          margin: 2px 0 0 0;
        }
      }
    }

    .context {
      height: auto;
      justify-content: flex-end;
      margin: 0 0 15px;

      .context_text {
        color: ${props => props.theme.colors.textColorLight};
        font-size: 12px;
        font-weight: 400;
        line-height: 1.2;
      }
    }

    .dialogue_button_container {
      height: auto;

      .dialogue_button {
        ${ButtonCSS}
        width: 100%;
      }
    }
  }

  footer {
    margin-bottom: 0;
    padding-top: 20px;

    .footer_text {
      color: ${props => props.theme.colors.textColorLight};
      font-size: 12px;
      font-weight: 400;
    }
  }
`

interface Props {
  threadName: string
}

export const ThreeBoxComments = (props: Props) => {
  const context: ConnectedWeb3Context = useConnectedWeb3Context()
  const { threadName } = props

  const [box, setBox] = useState<any>(null)
  // TODO: fix with useConnectedWeb3Wallet context
  const [currentUserAddress, setCurrentUserAddress] = useState<string>(context.account || '')

  useEffect(() => {
    let isSubscribed = true

    const handle3boxLogin = async () => {
      const { library } = context
      // TODO: fix with useConnectedWeb3Wallet context
      const account = context.account || ''

      logger.log(`Open three box with account ${account}`)

      const newBox = await Box.openBox(account, library._web3Provider)

      const spaceData = await Box.getSpace(account, THREEBOX_SPACE_NAME)
      if (Object.keys(spaceData).length === 0) {
        await newBox.openSpace(THREEBOX_SPACE_NAME)
      }
      if (isSubscribed) setCurrentUserAddress(account)

      newBox.onSyncDone(() => {
        if (isSubscribed) setBox(newBox)
        logger.log(`Three box sync with account ${account}`)
      })
    }

    handle3boxLogin()

    return () => {
      isSubscribed = false
    }
  }, [context])

  return (
    <ThreeBoxCustom>
      <CommentsTitle>Comments</CommentsTitle>
      <ThreeBoxCommentsReact
        adminEthAddr={THREEBOX_ADMIN_ADDRESS}
        box={box}
        currentUserAddr={currentUserAddress}
        showCommentCount={10}
        spaceName={THREEBOX_SPACE_NAME}
        threadName={threadName}
        useHovers={true}
      />
    </ThreeBoxCustom>
  )
}
