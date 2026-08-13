import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Tracks whether the user is near the bottom and only auto-scrolls while they are.
 * `shouldAutoScrollRef` is a ref because message updates arrive quickly during SSE streaming.
 */
export default function useAutoScroll(messages) {
  const messagesRef = useRef(null)
  const bottomRef = useRef(null)
  const shouldAutoScrollRef = useRef(true)
  const scrollFrameRef = useRef(null)
  const [isLastBlockVisible, setIsLastBlockVisible] = useState(true)

  const scrollMessagesToBottom = useCallback((behavior = 'auto') => {
    const element = messagesRef.current
    if (!element) return

    if (scrollFrameRef.current) {
      cancelAnimationFrame(scrollFrameRef.current)
    }

    scrollFrameRef.current = requestAnimationFrame(() => {
      if (behavior === 'smooth') {
        element.scrollTo({ top: element.scrollHeight, behavior: 'smooth' })
      } else {
        element.scrollTop = element.scrollHeight
      }
      scrollFrameRef.current = null
    })
  }, [])

  const onMessagesScroll = useCallback(() => {
    const element = messagesRef.current
    if (!element) return
    const distanceFromBottom = element.scrollHeight - element.scrollTop - element.clientHeight
    const isNearBottom = distanceFromBottom < 90
    shouldAutoScrollRef.current = isNearBottom
    setIsLastBlockVisible(isNearBottom)
  }, [])

  const goToBottom = useCallback(() => {
    setIsLastBlockVisible(true)
    shouldAutoScrollRef.current = true
    scrollMessagesToBottom('smooth')
  }, [scrollMessagesToBottom])

  useEffect(() => {
    if (shouldAutoScrollRef.current) {
      scrollMessagesToBottom('auto')
    }
  }, [messages, scrollMessagesToBottom])

  useEffect(() => () => {
    if (scrollFrameRef.current) {
      cancelAnimationFrame(scrollFrameRef.current)
    }
  }, [])

  return {
    bottomRef,
    goToBottom,
    isLastBlockVisible,
    messagesRef,
    onMessagesScroll,
    setIsLastBlockVisible,
    shouldAutoScrollRef,
  }
}
