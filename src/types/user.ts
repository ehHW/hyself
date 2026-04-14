export interface PermissionItem {
    id: number
    code: string
    name: string
    description: string
}

export interface RoleItem {
    id: number
    name: string
    description: string
    permissions: PermissionItem[]
}

export interface UserItem {
    id: number
    username: string
    email: string
    display_name: string
    avatar: string
    phone_number: string
    is_active: boolean
    is_staff: boolean
    is_superuser: boolean
    roles: RoleItem[]
    created_at: string
    updated_at: string
    deleted_at: string | null
}

export interface PermissionContext {
    permission_codes: string[]
    visible_menu_keys: string[]
}

export interface LoginResponse {
    access: string
    refresh: string
    user: UserItem
}

export interface ListResult<T> {
    count: number
    next: string | null
    previous: string | null
    results: T[]
}
