import { Component, OnInit, OnDestroy, Input, Output, EventEmitter } from '@angular/core'
import { Subject } from 'rxjs'
import { takeUntil } from 'rxjs/operators'
import { ProfilesService } from '../services/profiles.service'
import { ConfigService } from '../services/config.service'
import { Profile, PartialProfile, ProfileGroup, PartialProfileGroup } from '../api/profileProvider'

interface CollapsableProfileGroup extends ProfileGroup {
    collapsed: boolean
}

@Component({
    selector: 'profile-sidebar',
    template: `
        <div class="profile-sidebar" [class.collapsed]="collapsed" [class.expanded]="!collapsed">
            <div class="profile-sidebar-header" (click)="toggleCollapse()">
                <span class="toggle-icon">{{ collapsed ? '▶' : '▼' }}</span>
                <span class="header-text">Profiles</span>
                <span class="spacer"></span>
                <button class="btn btn-sm btn-outline-secondary hide-button" (click)="$event.stopPropagation(); hideSidebar()">
                    ×
                </button>
            </div>
            <div class="profile-sidebar-content" *ngIf="!collapsed">
                <div class="profile-groups">
                    <ng-container *ngFor="let group of profileGroups">
                        <div class="profile-group" *ngIf="isGroupVisible(group)">
                            <div
                                class="group-header"
                                (click)="toggleGroupCollapse(group)"
                                *ngIf="group.profiles && group.profiles.length > 0"
                            >
                                <span class="group-toggle-icon">{{ group.collapsed ? '▶' : '▼' }}</span>
                                <span class="group-name">{{ group.name || 'Ungrouped' }}</span>
                                <span class="profile-count">({{ group.profiles.length }})</span>
                            </div>
                            <div class="profile-list" *ngIf="!group.collapsed">
                                <div
                                    *ngFor="let profile of group.profiles"
                                    class="profile-item"
                                    (click)="launchProfile(profile)"
                                    [title]="profile.name"
                                >
                                    <div class="profile-name">{{ profile.name }}</div>
                                </div>
                            </div>
                        </div>
                    </ng-container>
                </div>
            </div>
        </div>
    `,
    styles: [`
        .profile-sidebar {
            position: relative;
            width: 280px;
            min-width: 280px;
            background: rgba(0, 0, 0, 0.9);
            border-right: 1px solid rgba(255, 255, 255, 0.1);
            z-index: 100;
            transition: width 0.3s ease, min-width 0.3s ease;
            backdrop-filter: blur(10px);
            display: flex;
            flex-direction: column;
            height: 100%;
        }

        /* Solid background during width transitions to prevent flashing */
        .profile-sidebar:is(.collapsed, .expanded) {
            background: rgba(0, 0, 0, 1);
        }

        .profile-sidebar.collapsed {
            width: 32px;
            min-width: 32px;
        }

        .profile-sidebar.expanded {
            width: 280px;
            min-width: 280px;
        }

        .profile-sidebar-header {
            height: 32px;
            display: flex;
            align-items: center;
            padding: 0 12px;
            cursor: pointer;
            user-select: none;
            background: rgba(0, 0, 0, 0.8);
            border-bottom: 1px solid rgba(255, 255, 255, 0.1);
            flex-shrink: 0;
        }

        .toggle-icon {
            margin-right: 8px;
            font-size: 12px;
            color: #aaa;
            transition: transform 0.2s ease;
        }

        .header-text {
            color: #aaa;
            font-size: 12px;
            font-weight: bold;
            text-transform: uppercase;
        }

        .spacer {
            flex: 1;
        }

        .hide-button {
            padding: 2px 8px;
            font-size: 14px;
            line-height: 1;
            border: 1px solid rgba(255, 255, 255, 0.2);
            background: transparent;
            color: #aaa;
        }

        .hide-button:hover {
            background: rgba(255, 255, 255, 0.1);
            color: #fff;
        }

        .profile-sidebar-content {
            flex: 1;
            overflow-y: auto;
            overflow-x: hidden;
            padding: 8px 0;
        }

        .profile-groups {
            padding: 0 8px;
        }

        .profile-group {
            margin-bottom: 8px;
        }

        .group-header {
            display: flex;
            align-items: center;
            padding: 6px 8px;
            cursor: pointer;
            user-select: none;
            border-radius: 4px;
            transition: background-color 0.2s ease;
        }

        .group-header:hover {
            background: rgba(255, 255, 255, 0.05);
        }

        .group-toggle-icon {
            margin-right: 6px;
            font-size: 10px;
            color: #888;
            width: 12px;
        }

        .group-name {
            color: #ccc;
            font-size: 11px;
            font-weight: bold;
            text-transform: uppercase;
            flex: 1;
        }

        .profile-count {
            color: #888;
            font-size: 10px;
        }

        .profile-list {
            margin-left: 12px;
            border-left: 1px solid rgba(255, 255, 255, 0.1);
            padding-left: 8px;
        }

        .profile-item {
            display: flex;
            align-items: center;
            padding: 4px 8px;
            cursor: pointer;
            border-radius: 3px;
            transition: all 0.15s ease;
            margin-bottom: 1px;
        }

        .profile-item:hover {
            background: rgba(255, 255, 255, 0.08);
            transform: translateX(1px);
        }

        .profile-name {
            color: #ddd;
            font-size: 13px;
            font-weight: 400;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }

        /* Collapsed state - hide everything except toggle */
        .profile-sidebar.collapsed .header-text,
        .profile-sidebar.collapsed .hide-button,
        .profile-sidebar.collapsed .profile-sidebar-content {
            display: none;
        }

        .profile-sidebar.collapsed .toggle-icon {
            margin-right: 0;
        }

        .profile-sidebar.collapsed .profile-sidebar-header {
            justify-content: center;
        }
    `],
})
export class ProfileSidebarComponent implements OnInit, OnDestroy {
    @Input() collapsed = false
    @Output() collapsedChange = new EventEmitter<boolean>()
    @Output() hide = new EventEmitter<void>()

    profileGroups: PartialProfileGroup<CollapsableProfileGroup>[] = []
    private destroy$ = new Subject<void>()

    constructor (
        private profilesService: ProfilesService,
        private config: ConfigService,
    ) {}

    async ngOnInit (): Promise<void> {
        await this.refreshProfileGroups()

        // Subscribe to config changes to refresh profiles
        this.config.changed$.pipe(
            takeUntil(this.destroy$),
        ).subscribe(() => {
            this.refreshProfileGroups()
        })
    }

    ngOnDestroy (): void {
        this.destroy$.next()
        this.destroy$.complete()
    }

    toggleCollapse (): void {
        this.collapsed = !this.collapsed
        this.collapsedChange.emit(this.collapsed)
    }

    hideSidebar (): void {
        this.hide.emit()
    }

    async refreshProfileGroups (): Promise<void> {
        try {
            const profileGroupCollapsed = JSON.parse(localStorage.getItem('profileSidebarGroupCollapsed') ?? '{}')
            const groups = await this.profilesService.getProfileGroups({
                includeNonUserGroup: true,
                includeProfiles: true,
            })

            // Sort groups
            groups.sort((a, b) => a.name.localeCompare(b.name))
            groups.sort((a, b) => (a.id === 'built-in' || !a.editable ? 1 : 0) - (b.id === 'built-in' || !b.editable ? 1 : 0))
            groups.sort((a, b) => (a.id === 'ungrouped' ? 0 : 1) - (b.id === 'ungrouped' ? 0 : 1))

            this.profileGroups = groups.map(g => ({
                ...g,
                collapsed: profileGroupCollapsed[g.id] ?? false,
            } as PartialProfileGroup<CollapsableProfileGroup>))
        } catch (error) {
            console.error('Error refreshing profile groups:', error)
            this.profileGroups = []
        }
    }

    isGroupVisible (group: PartialProfileGroup<ProfileGroup>): boolean {
        return (group.profiles ?? []).length > 0
    }

    toggleGroupCollapse (group: PartialProfileGroup<CollapsableProfileGroup>): void {
        if ((group.profiles?.length ?? 0) === 0) {
            return
        }
        group.collapsed = !group.collapsed
        this.saveProfileGroupCollapse(group)
    }

    launchProfile (profile: PartialProfile<Profile>): void {
        this.profilesService.openNewTabForProfile(profile)
    }

    private saveProfileGroupCollapse (group: PartialProfileGroup<CollapsableProfileGroup>): void {
        try {
            const profileGroupCollapsed = JSON.parse(localStorage.getItem('profileSidebarGroupCollapsed') ?? '{}')
            profileGroupCollapsed[group.id] = group.collapsed
            localStorage.setItem('profileSidebarGroupCollapsed', JSON.stringify(profileGroupCollapsed))
        } catch (error) {
            console.error('Error saving group collapse state:', error)
        }
    }
}
