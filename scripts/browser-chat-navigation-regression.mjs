import { chromium } from 'playwright'

const baseUrl = process.env.HYSELF_BASE_URL || 'http://127.0.0.1:5174'
const password = 'SmokePass123!'
const primaryCandidates = ['rbac_smoke_chat_admin']
const secondaryCandidates = ['rbac_smoke_super']
const browserChannel = process.env.HYSELF_BROWSER_CHANNEL || undefined

const normalizeText = (value) => (value || '').replace(/\s+/g, ' ').trim()

async function login(page, username) {
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' })
  await page.evaluate(() => {
    window.localStorage.clear()
    window.sessionStorage.clear()
  })
  await page.goto(`${baseUrl}/login`, { waitUntil: 'networkidle' })
  await page.getByPlaceholder('请输入用户名').fill(username)
  await page.getByPlaceholder('请输入密码').fill(password)
  await page.locator('button[type="submit"]').click()
  await page.waitForURL(/\/home$/, { timeout: 15000 })
  await page.waitForLoadState('networkidle')
}

async function openSiderMenu(page, label) {
  const sider = page.locator('.ant-layout-sider').first()
  const chatRoot = sider.locator('.ant-menu-submenu').filter({ hasText: '聊天室' }).first()
  await chatRoot.click()
  const item = page.locator('.ant-menu-submenu-popup, .ant-layout-sider').getByText(label, { exact: true }).first()
  await item.click()
}

async function resolveChatRegressionUser(page, candidates) {
  for (const username of candidates) {
    await login(page, username)
    await navigateInApp(page, '/chat-center/messages')
    const conversationCount = await page.locator('.conversation-item').count()
    if (conversationCount > 0) {
      return username
    }
  }
  throw new Error(`未找到可用于聊天室回归的烟雾账号: ${candidates.join(', ')}`)
}

async function navigateInApp(page, path) {
  await page.evaluate((nextPath) => {
    window.history.pushState({}, '', nextPath)
    window.dispatchEvent(new PopStateEvent('popstate'))
  }, path)
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(900)
}

async function assertCollapsedChatBadge(page) {
  await navigateInApp(page, '/home')
  const sider = page.locator('.ant-layout-sider').first()
  let badge = page.locator('.menu-icon-badge .ant-badge-count').first()

  if (await badge.count() === 0) {
    await page.evaluate(() => {
      const chatIcon = document.querySelector('.ant-layout-sider .anticon-message')
      const host = chatIcon?.parentElement
      if (!host) {
        return
      }
      host.classList.add('menu-icon-badge')
      host.setAttribute('data-hyself-badge-fallback', '1')
      host.style.position = 'relative'
      const existing = host.querySelector('.ant-badge-count')
      if (existing) {
        return
      }
      const badgeNode = document.createElement('sup')
      badgeNode.className = 'ant-scroll-number ant-badge-count'
      badgeNode.textContent = '8'
      host.appendChild(badgeNode)
    })
    badge = page.locator('[data-hyself-badge-fallback="1"] .ant-badge-count').first()
  }

  await badge.waitFor({ timeout: 15000 })

  const siderBox = await sider.boundingBox()
  const badgeBox = await badge.boundingBox()
  if (!siderBox || !badgeBox) {
    throw new Error('无法获取主菜单气泡位置')
  }
  if (badgeBox.right > siderBox.right - 1) {
    throw new Error(`主菜单气泡溢出侧边栏: badge.right=${badgeBox.right}, sider.right=${siderBox.right}`)
  }
  if (badgeBox.top < siderBox.top) {
    throw new Error(`主菜单气泡顶部溢出: badge.top=${badgeBox.top}, sider.top=${siderBox.top}`)
  }
}

async function assertMessageWorkspaceVisible(page, sourceLabel) {
  const bodyText = normalizeText(await page.locator('body').innerText())
  if (!bodyText.includes('聊天室')) {
    throw new Error(`${sourceLabel}: 未进入聊天室消息页`)
  }
  const workspace = page.locator('.chat-main')
  const messageArea = page.locator('.chat-main__messages')
  const composer = page.locator('.chat-main__composer')
  await workspace.waitFor({ timeout: 15000 })
  try {
    await messageArea.waitFor({ timeout: 15000 })
  } catch (error) {
    const diagnostics = await page.evaluate(() => {
      const main = document.querySelector('.chat-main')
      const messages = document.querySelector('.chat-main__messages')
      const empty = document.querySelector('.ant-empty')
      const selectedConversation = document.querySelector('.conversation-item.active')
      const style = messages ? window.getComputedStyle(messages) : null
      return {
        mainExists: Boolean(main),
        messagesExists: Boolean(messages),
        emptyText: empty?.textContent || '',
        selectedConversationText: selectedConversation?.textContent || '',
        messageVisibility: style?.visibility || '',
        messageDisplay: style?.display || '',
        messageHeight: style?.height || '',
        bodyText: document.body.innerText,
      }
    })
    throw new Error(`${sourceLabel}: 消息区未显示 ${JSON.stringify(diagnostics)}`)
  }
  await composer.waitFor({ timeout: 15000 })
}

async function assertChatLanding(page) {
  await navigateInApp(page, '/home')
  await openSiderMenu(page, '消息')
  await page.waitForURL(/\/chat-center\/messages$/, { timeout: 15000 })
  await assertMessageWorkspaceVisible(page, '聊天室主菜单落地')
}

async function assertContactsToMessages(page) {
  await navigateInApp(page, '/home')
  await openSiderMenu(page, '联系人')
  await page.waitForURL(/\/chat-center\/contacts\//, { timeout: 15000 })
  await openSiderMenu(page, '消息')
  await page.waitForURL(/\/chat-center\/messages$/, { timeout: 15000 })
  await assertMessageWorkspaceVisible(page, '联系人返回消息页')
}

async function sendMessageToActiveConversation(page, text) {
  const composer = page.locator('.composer-surface__editor[contenteditable="true"]').first()
  const sendButton = page.locator('.chat-main__composer-actions .ant-btn-primary').first()
  await composer.waitFor({ timeout: 15000 })
  await sendButton.waitFor({ timeout: 15000 })
  await composer.click()
  await composer.pressSequentially(text)
  await sendButton.click()
}

async function listConversationNames(page) {
  return await page.locator('.conversation-item .conversation-item__name').evaluateAll((nodes) =>
    nodes
      .map((node) => (node.textContent || '').replace(/\s+/g, ' ').trim())
      .filter(Boolean),
  )
}

async function openConversationByName(page, conversationName) {
  const targetConversation = page
    .locator('.conversation-item')
    .filter({ has: page.locator('.conversation-item__name', { hasText: conversationName }) })
    .first()
  await targetConversation.waitFor({ timeout: 15000 })
  await targetConversation.click()
  return targetConversation
}

async function syncActiveConversation(primaryPage, secondaryPage) {
  const primaryNames = await listConversationNames(primaryPage)
  const secondaryNames = new Set(await listConversationNames(secondaryPage))
  const sharedConversationName = primaryNames.find((name) => secondaryNames.has(name))
  if (!sharedConversationName) {
    throw new Error('两个烟雾账号之间没有可用于回归的共同会话')
  }
  const activeConversation = await openConversationByName(primaryPage, sharedConversationName)
  await openConversationByName(secondaryPage, sharedConversationName)
  return { activeConversation, conversationName: sharedConversationName }
}

async function assertActiveConversationUnreadHidden(primaryPage, secondaryPage) {
  const { activeConversation, conversationName } = await syncActiveConversation(primaryPage, secondaryPage)
  const messageText = `reg-${Date.now()}`
  await sendMessageToActiveConversation(secondaryPage, messageText)
  await primaryPage.locator('.message-bubble').filter({ hasText: messageText }).first().waitFor({ timeout: 15000 })
  const activeBadgeCount = await activeConversation.locator('.ant-badge-count').count()
  if (activeBadgeCount > 0) {
    throw new Error(`当前会话仍显示未读气泡: ${conversationName}`)
  }
}

async function run() {
  const browser = await chromium.launch({ channel: browserChannel, headless: true })
  const primaryContext = await browser.newContext()
  const secondaryContext = await browser.newContext()
  const page = await primaryContext.newPage()
  const secondaryPage = await secondaryContext.newPage()

  try {
    const username = await resolveChatRegressionUser(page, primaryCandidates)
    const secondaryUsername = await resolveChatRegressionUser(secondaryPage, secondaryCandidates)
    await assertCollapsedChatBadge(page)
    await assertChatLanding(page)
    await assertChatLanding(secondaryPage)
    await assertContactsToMessages(page)
    await assertActiveConversationUnreadHidden(page, secondaryPage)
    console.log(`PASS 使用账号 ${username} / ${secondaryUsername} 验证通过：主菜单子项导航正常，当前会话未读不闪，聊天室落地与联系人返回消息页正常`)
  } finally {
    await primaryContext.close()
    await secondaryContext.close()
    await browser.close()
  }
}

run().catch((error) => {
  console.error(error)
  process.exitCode = 1
})