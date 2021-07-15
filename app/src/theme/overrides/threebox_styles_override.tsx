import { css } from 'styled-components'

import { ButtonCSS } from '../../components/button/button_styling_types'

const COMMENT_AVATAR_DIMENSIONS = '32px'

export const ThreeboxStylesOverride = css`
  .threeBoxCustom > .threebox-comments-react {
    max-width: 100%;
    min-width: 100%;
    overflow: hidden;
    padding: 0;

    .input {
      margin-left: 8px;
      margin-right: 8px;
    }

    .dialogue_button_container {
      height: auto;

      .dialogue_button {
        ${ButtonCSS}
        width: 100%;
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
        border-bottom: 1px solid ${props => props.theme.primary4};
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


    footer {
      max-width: 100%;
      .footer_text {
        display: block;
        text-align: center;
      }

      * {
        max-width: 100%;
      }
    }
  }
`
