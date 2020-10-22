import React from 'react'
interface Props {
  size?: string
}

export const IconVerified = (props: Props) => {
  const { size = '20' } = props
  return (
    <svg fill="none" height={size} viewBox="0 0 20 20" width={size} xmlns="http://www.w3.org/2000/svg">
      <path
        clipRule="evenodd"
        d="M9.53333 20C10.8956 20 12.0844 19.2546 12.7166 18.1481C13.1702 18.3496 13.6721 18.4615 14.2 18.4615C16.225 18.4615 17.8667 16.8144 17.8667 14.7826C17.8667 14.4756 17.8292 14.1774 17.7586 13.8923C19.0757 13.3343 20 12.0263 20 10.5017C20 9.12216 19.2432 7.91999 18.1235 7.29027C18.3017 6.85765 18.4 6.38349 18.4 5.88629C18.4 3.85447 16.7584 2.20736 14.7333 2.20736C14.4145 2.20736 14.1052 2.24818 13.8103 2.3249C13.2728 0.963121 11.9485 0 10.4 0C9.03408 0 7.8426 0.749389 7.21169 1.86075C6.79524 1.69591 6.3415 1.60535 5.86667 1.60535C3.84162 1.60535 2.2 3.25246 2.2 5.28428C2.2 5.5823 2.23532 5.87205 2.30199 6.14954C0.952766 6.69271 0 8.01732 0 9.56522C0 10.9225 0.732586 12.1081 1.82267 12.7458C1.63638 13.1867 1.53333 13.6716 1.53333 14.1806C1.53333 16.2124 3.17496 17.8595 5.2 17.8595C5.52764 17.8595 5.84523 17.8164 6.14747 17.7355C6.69992 19.0653 8.00783 20 9.53333 20ZM6.8339 9.82532C6.45558 9.42296 5.82271 9.40347 5.42035 9.78179C5.018 10.1601 4.99851 10.793 5.37683 11.1953L7.75215 13.7216C8.20634 14.2046 8.97639 14.1963 9.42005 13.7036L14.7207 7.81657C15.0903 7.40614 15.0572 6.77385 14.6467 6.40429C14.2363 6.03474 13.604 6.06788 13.2345 6.47831L8.56401 11.6654L6.8339 9.82532Z"
        fill="#5C6BC0"
        fillRule="evenodd"
      />
    </svg>
  )
}
