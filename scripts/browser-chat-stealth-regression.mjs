import { chromium } from 'playwright'

const baseUrl = process.env.HYSELF_BASE_URL || 'http://127.0.0.1:5174'
const password = 'SmokePass123!'
const browserChannel = process.env.HYSELF_BROWSER_CHANNEL || undefined

const inspectorUsername = 'rbac_smoke_super'
const friendNoticeUsername = 'rbac_smoke_chat_admin'
const senderUsername = 'admin'
const stealthConversationTitle = 'admin(管理员甲)和rbac_smoke_chat_admin(聊天乙)的私聊会话'
const senderConversationTitle = '聊天乙'

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

async function navigateInApp(page, path) {
  await page.evaluate((nextPath) => {
    window.history.pushState({}, '', nextPath)
    window.dispatchEvent(new PopStateEvent('popstate'))
  }, path)
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(900)
}

async function logout(page) {
  await page.locator('.user-trigger').hover()
  await page.getByText('退出登录', { exact: true }).click()
  await page.waitForURL(/\/login$/, { timeout: 15000 })
}

async function getFriendNoticeBadgeCount(page) {
  await navigateInApp(page, '/chat-center/contacts/friend-notices')
  const shortcut = page.locator('.contact-shortcut').filter({ hasText: '好友通知' }).first()
  await shortcut.waitFor({ timeout: 15000 })
  const badge = shortcut.locator('.ant-badge-count').first()
  if (await badge.count() === 0) {
    return 0
  }
  return Number.parseInt(normalizeText(await badge.innerText()) || '0', 10) || 0
}

async function assertFriendNoticeStableAcrossRelogin(page) {
  const counts = []
  for (let index = 0; index < 3; index += 1) {
    await login(page, friendNoticeUsername)
    counts.push(await getFriendNoticeBadgeCount(page))
    await logout(page)
  }
  if (counts.some((count) => count !== 0)) {
    throw new Error(`好友通知气泡在重复登录后不稳定: ${counts.join(', ')}`)
  }
}

async function ensureInspectEnabled(page, enabled) {
  await navigateInApp(page, '/chat-center/settings/inspect')
  const toggle = page.locator('.ant-switch').first()
  await toggle.waitFor({ timeout: 15000 })
  const checked = await toggle.evaluate((node) => node.classList.contains('ant-switch-checked'))
  if (checked !== enabled) {
    await toggle.click()
    await page.waitForTimeout(1200)
  }
}

async function listConversationNames(page) {
  return await page.locator('.conversation-item .conversation-item__name').evaluateAll((nodes) =>
    nodes.map((node) => (node.textContent || '').replace(/\s+/g, ' ').trim()).filter(Boolean),
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

async function sendMessageToActiveConversation(page, text) {
  const composer = page.locator('.composer-surface__editor[contenteditable="true"]').first()
  const sendButton = page.locator('.chat-main__composer-actions .ant-btn-primary').first()
  await composer.waitFor({ timeout: 15000 })
  await sendButton.waitFor({ timeout: 15000 })
  await composer.click()
  await composer.pressSequentially(text)
  await sendButton.click()
}

async function assertStealthConversationAndPush(inspectorPage, senderPage) {
  await login(inspectorPage, inspectorUsername)
  await login(senderPage, senderUsername)

  await ensureInspectEnabled(inspectorPage, true)
  await navigateInApp(inspectorPage, '/chat-center/messages')
  await navigateInApp(senderPage, '/chat-center/messages')

  const inspectorNames = await listConversationNames(inspectorPage)
  if (!inspectorNames.includes(stealthConversationTitle)) {
    throw new Error(`开启巡检后未看到直聊会话: ${JSON.stringify(inspectorNames)}`)
  }

  const inspectorConversation = await openConversationByName(inspectorPage, stealthConversationTitle)
  const senderConversation = await openConversationByName(senderPage, senderConversationTitle)

  const workspaceTitle = normalizeText(await inspectorPage.locator('.chat-main__title').first().innerText())
  if (workspaceTitle !== stealthConversationTitle) {
    throw new Error(`巡检直聊标题不正确: ${workspaceTitle}`)
  }

  const avatarText = normalizeText(await inspectorConversation.locator('.ant-avatar').first().innerText())
  if (!avatarText || avatarText === '?') {
    throw new Error(`巡检直聊头像回退异常: ${avatarText}`)
  }

  const pushedMessage = `stealth-on-${Date.now()}`
  await senderConversation.click()
  await sendMessageToActiveConversation(senderPage, pushedMessage)
  await inspectorPage.locator('.message-bubble').filter({ hasText: pushedMessage }).first().waitFor({ timeout: 15000 })

  await ensureInspectEnabled(inspectorPage, false)
  await navigateInApp(inspectorPage, '/chat-center/messages')
  await inspectorPage.waitForTimeout(1200)
  const namesAfterDisable = await listConversationNames(inspectorPage)
  if (namesAfterDisable.includes(stealthConversationTitle)) {
    throw new Error(`关闭巡检后直聊会话仍然可见: ${JSON.stringify(namesAfterDisable)}`)
  }

  const hiddenMessage = `stealth-off-${Date.now()}`
  await navigateInApp(senderPage, '/chat-center/messages')
  await openConversationByName(senderPage, senderConversationTitle)
  await sendMessageToActiveConversation(senderPage, hiddenMessage)
  await inspectorPage.waitForTimeout(2500)
  const bodyText = normalizeText(await inspectorPage.locator('body').innerText())
  if (bodyText.includes(hiddenMessage)) {
    throw new Error('关闭巡检后仍然收到了直聊新消息推送')
  }
}

async function run() {
  const browser = await chromium.launch({ channel: browserChannel, headless: true })
  const noticeContext = await browser.newContext()
  const inspectorContext = await browser.newContext()
  const senderContext = await browser.newContext()
  const noticePage = await noticeContext.newPage()
  const inspectorPage = await inspectorContext.newPage()
  const senderPage = await senderContext.newPage()

  try {
    await assertFriendNoticeStableAcrossRelogin(noticePage)
    await assertStealthConversationAndPush(inspectorPage, senderPage)
    console.log('PASS 好友通知重复登录稳定，巡检模式直聊列表/标题/头像/新消息推送均符合预期')
  } finally {
    await noticeContext.close()
    await inspectorContext.close()
    await senderContext.close()
    await browser.close()
  }
}

run().catch((error) => {
  console.error(error)
  process.exitCode = 1
})