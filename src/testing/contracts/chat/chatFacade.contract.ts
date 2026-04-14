import type { ChatStoreFacade } from '@/stores/chat'

type Assert<T extends true> = T
type HasKey<T, K extends PropertyKey> = K extends keyof T ? true : false

type _FacadeHasStateNamespace = Assert<HasKey<ChatStoreFacade, 'state'>>
type _FacadeHasLifecycleNamespace = Assert<HasKey<ChatStoreFacade, 'lifecycle'>>
type _FacadeHasAuditNamespace = Assert<HasKey<ChatStoreFacade, 'audit'>>
type _FacadeHasConversationNamespace = Assert<HasKey<ChatStoreFacade, 'conversation'>>
type _FacadeHasFriendshipNamespace = Assert<HasKey<ChatStoreFacade, 'friendship'>>
type _FacadeHasGroupNamespace = Assert<HasKey<ChatStoreFacade, 'group'>>
type _FacadeHasMessageNamespace = Assert<HasKey<ChatStoreFacade, 'message'>>

type _StateHasConversationState = Assert<HasKey<ChatStoreFacade['state'], 'conversationState'>>
type _StateHasMessageState = Assert<HasKey<ChatStoreFacade['state'], 'messageState'>>
type _StateHasFriendshipState = Assert<HasKey<ChatStoreFacade['state'], 'friendshipState'>>
type _StateHasGroupState = Assert<HasKey<ChatStoreFacade['state'], 'groupState'>>

type _ConversationStateDoesNotExposeFlatConversationList = Assert<HasKey<ChatStoreFacade['state'], 'conversations'> extends true ? false : true>
type _ConversationStateDoesNotExposeAudit = Assert<HasKey<ChatStoreFacade['state']['conversationState'], 'adminConversations'> extends true ? false : true>
type _FacadeDoesNotExposeFlatConversation = Assert<HasKey<ChatStoreFacade, 'conversations'> extends true ? false : true>
type _FacadeDoesNotExposeFlatMessages = Assert<HasKey<ChatStoreFacade, 'activeMessages'> extends true ? false : true>
type _FacadeDoesNotExposeFlatFriends = Assert<HasKey<ChatStoreFacade, 'friends'> extends true ? false : true>
type _FacadeDoesNotExposeFlatSearch = Assert<HasKey<ChatStoreFacade, 'searchResult'> extends true ? false : true>
type _FacadeDoesNotExposeFlatActions = Assert<HasKey<ChatStoreFacade, 'loadConversations'> extends true ? false : true>

type _AuditNamespaceOwnsSearchResult = Assert<HasKey<ChatStoreFacade['audit'], 'searchResult'>>
type _AuditNamespaceOwnsClearSearch = Assert<HasKey<ChatStoreFacade['audit'], 'clearSearchResult'>>
type _MessageNamespaceOwnsSendText = Assert<HasKey<ChatStoreFacade['message'], 'sendTextMessage'>>
type _ConversationNamespaceOwnsSelection = Assert<HasKey<ChatStoreFacade['conversation'], 'selectConversation'>>
type _FriendshipNamespaceOwnsLoad = Assert<HasKey<ChatStoreFacade['friendship'], 'loadFriends'>>
type _GroupNamespaceOwnsMembers = Assert<HasKey<ChatStoreFacade['group'], 'loadMembers'>>

export { }