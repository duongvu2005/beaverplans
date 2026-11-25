import type { WeekPhase } from '@/core/types';
// The English catalog, and the shape every other catalog must match.
export const en = {
    common: {
        cancel: 'Cancel',
        save: 'Save',
        close: 'Close',
        delete: 'Delete',
        done: 'Done',
        back: 'Back',

        doneOf: (done: number, total: number) => `${done}/${total} done`,

        dueCount: (n: number) => `${n} due`,

        untitled: 'Untitled',
        projectFallback: 'Project',
        taskFallback: 'Task',

        weights: {
            easy: 'Easy',
            medium: 'Medium',
            hard: 'Hard',
        },
    },

    projectView: {
        eyebrow: 'Projects',
        copyPlan: 'Copy plan',
        pastePlan: 'Paste plan',
    },

    projectList: {
        addProject: '+ add project',
        projectLimit: (limit: number) => `${limit} projects per week`,
    },

    projectCard: {
        dragProject: 'Drag to reorder project',
        namePlaceholder: 'Project name…',
        setDeadline: 'Set deadline',
        deleteProject: 'Delete project',
        addTask: 'add task',
        taskLimit: (limit: number) => `${limit} tasks per project`,
    },

    taskRow: {
        dragTitle: 'Drag to reorder, or move to another project',
        dragLabel: 'Drag to reorder task',
        namePlaceholder: 'Task…',
        assignTitle: 'Assign which days to do this',
        assignDays: 'assign days',
        editTask: 'Edit task',
        editTitle: 'Assign days / split / deadline',
        deleteTask: 'Delete task',
    },

    subtaskRow: {
        dragTitle: 'Drag to reorder, or move to another day',
        dragLabel: 'Drag to reorder subtask',
        notePlaceholder: 'add a note (optional)',
        removeLabel: 'Remove subtask',
        removeTitle: 'Remove',
    },

    projectEditor: {
        eyebrow: 'Project',
        deadline: 'Deadline',
        clear: 'Clear',
    },

    taskEditor: {
        deadline: 'Deadline',
        clear: 'Clear',
        days: 'Days',
        daysLabel: 'Days to work on this task',
        addSubtaskOn: (day: string) => `+ add subtask on ${day}`,
        subtaskLimit: (limit: number) => `${limit} subtasks is the limit for one task. Remove one to add another`,
        daysHint: 'Use the dots to set difficulty — harder subtasks count more toward your progress',
        note: 'Note',
        notePlaceholder: 'a note about the whole task (optional)',
    },

    weightChip: {
        title: 'Weight',
        titleOf: (label: string) => `Weight — ${label}`,
        weightOf: (name: string) => `Weight: ${name}`,
        hint: 'Harder subtasks count more toward your progress',
        counts: (multiplier: string) => `${multiplier}`,
    },

    weightDots: {
        label: 'Weight',
    },

    pastePlanDialog: {
        title: 'Paste a plan',
        intro: 'Add projects from another week',
        placeholder: 'Paste here',
        boxLabel: 'Paste a copied plan',
        add: 'Add to this week',

        reasons: {
            'not-json': 'This doesn’t appear to be a copied plan. Copy a plan from any week and try again',
            'not-beaverplans': 'This isn’t a copied plan. If you meant to paste your entire backup, that’s a different file and can’t be added to a single week',
            malformed: 'This copy is either corrupted or was created with an older version of beaverplans',
            'too-long': 'A name or a note in this copy is too long. Shorten it, then try again',
        },

        tooBig: (projects: number, maxTasks: number, maxSubtasks: number, limitProjects: number, limitTasks: number, limitSubtasks: number) => `This copy is too big for one week. It has ${projects} projects (limit ${limitProjects}), up to ${maxTasks} tasks in one project (limit ${limitTasks}), and up to ${maxSubtasks} subtasks in one task (limit ${limitSubtasks})`,

        found: (projects: number, tasks: number, range: string) => `${projects} project${projects === 1 ? '' : 's'}, ${tasks} task${tasks === 1 ? '' : 's'}, copied from ${range}`,
        tooMany: (found: number, room: number, limit: number) => `That is ${found} projects, but this week only has room for ${room}. The limit is ${limit} projects for one week`,

        keepProgress: 'Keep completion progression',
        keepHint: 'When disabled, past completions and missed days won’t carry over',
    },

    weekList: {
        eyebrow: 'Weeks',

        emptyTitle: 'No weeks yet',
        emptyText: 'Every week you plan is listed here',

        weekCount: (n: number) => `${n} week${n === 1 ? '' : 's'}`,
        clearAll: 'Clear all',

        upcomingWeeks: (n: number) => `${n} upcoming weeks`,
        expand: 'Show the upcoming weeks',
        collapse: 'Hide the upcoming weeks',

        copyTitle: (range: string) => `Copy ${range}`,

        deleteTitle: (range: string) => `Delete ${range}?`,
        deleteBody: 'This permanently deletes the week, including all projects and tasks',

        clearAllTitle: 'Delete every week?',
        clearAllConfirm: 'Delete all',
        clearAllBody: (n: number) => `This permanently deletes all ${n} week${n === 1 ? '' : 's'} and resets your stats`,
    },

    weekRow: {
        open: (range: string) => `Open week ${range}`,
        complete: 'complete',
        done: 'done',
        planned: 'planned',
        thisWeek: 'this week',
        upcoming: 'upcoming',
        notEnded: 'not ended',
        copy: (range: string) => `Copy week ${range} to clipboard`,
        remove: (range: string) => `Delete week ${range}`,
    },

    weekQuickLook: {
        eyebrow: 'Week',
        empty: 'Nothing was planned for this week',
        missed: (n: number) => `${n} missed`,
        view: 'View',
    },

    topBar: {
        views: {
            plan: 'Plan',
            stats: 'Stats',
            weeks: 'Weeks',
        },

        support: 'Support',
        supportTitle: 'Support this project',

        guest: 'Guest',
        signIn: 'Sign in',

        account: 'Account',
        accountOf: (username: string, email: string | undefined) => `Account: ${username}${email === undefined ? '' : ` (${email})`}`,
    },

    crashScreen: {
        appTitle: 'beaverplans hit a problem',
        appBody: 'Something went wrong while loading this page. Your plan is safe — try reloading the page to see if that fixes the problem',

        viewTitle: 'This tab couldn’t load',
        viewBody: 'Something went wrong while loading this tab. Your plan is safe — try reloading the tab to see if that fixes the problem',

        offerCopy: 'If you’d like an extra backup, you can download a copy of your plan now',
        download: 'Download a copy',
        reload: 'Reload beaverplans',
    },

    confirmDialog: {
        typeToConfirmLead: 'Type ',
        typeToConfirmRest: ' to confirm',
        confirm: 'Confirm',
    },

    copyPlanDialog: {
        copy: 'Copy',
        empty: 'This week has no projects to copy',
        projects: 'Projects',
        selectAll: 'Select all',
        deselectAll: 'Deselect all',

        taskCount: (n: number) => `${n} task${n === 1 ? '' : 's'}`,
        projectLabel: (name: string, tasks: string) => `${name}, ${tasks}`,
    },

    copyTextDialog: {
        title: 'Copy this yourself',
        body: 'This browser would not let the app write to your clipboard. Select the text below and copy it',
        boxLabel: 'The copied plan, as text',
    },

    languagePicker: {
        label: 'Language',

        english: 'English',
        vietnamese: 'Tiếng Việt',

        choose: (name: string) => `Switch to ${name}`,
    },

    themePicker: {
        label: 'Theme',

        options: {
            light: 'Light',
            dark: 'Dark',
            system: 'Auto',
        },
    },

    fontPicker: {
        label: 'Font',

        options: {
            modern: 'Modern',
            classic: 'Classic',
        },
    },

    guideToggle: {
        label: 'Guide',
    },

    authForm: {
        titles: {
            signin: 'Sign in',
            signup: 'Create your account',
            reset: 'Reset your password',
        },
        subtitles: {
            signin: 'Welcome back',
            signup: 'Your weeks, on every device you use',
            reset: 'We’ll email you a link to set a new one',
        },
        submits: {
            signin: 'Sign in',
            signup: 'Create account',
            reset: 'Send reset link',
        },
        switches: {
            signin: { prompt: 'No account?', action: 'Create one' },
            signup: { prompt: 'Already have one?', action: 'Sign in' },
            reset: { prompt: 'Remembered it?', action: 'Back to sign in' },
        },

        passwordLabel: 'Password',
        atLeast6: 'at least 6 characters',
        showPassword: 'Show password',
        hidePassword: 'Hide password',
        humanFirst: 'Confirm you’re human first',
        somethingWrong: 'Something went wrong. Try again',
        oneMoment: 'One moment…',
        sending: 'Sending…',
        backToWeek: 'Back to your week',
        checkYourEmail: 'Check your email',
        sentLinkTo: 'We sent a confirmation link to',
        enterPasswordToConfirm: 'Enter your password to confirm',
        passwordIncorrect: 'That password is incorrect',

        emailLabel: 'Email',
        emailPlaceholder: 'you@example.com',
        usernameLabel: 'Username',
        usernamePlaceholder: 'what should we call you?',
        confirmPasswordLabel: 'Confirm password',
        forgotPassword: 'Forgot password?',

        enterEmail: 'Enter your email',
        pickUsername: 'Pick a username',
        enterPassword: 'Enter your password',
        passwordTooShort: 'Password must be at least 6 characters',
        passwordsDontMatch: 'Passwords don’t match',
        resetLinkSent: 'If that email has an account, a reset link is on its way',

        openLinkToFinish: 'Open the link to finish creating your account. You’ll be signed in automatically',
        resendSent: 'Sent. If it still doesn’t arrive, check your spam folder',
        resendArmed: 'Confirm you’re human, then try again',
        resendFailed: 'Could not send it just now. Try again',
        sendAgain: 'Send it again',
        sendAgainIn: (seconds: number) => `Send it again in ${seconds}s`,
        useDifferentEmail: 'Use a different email',

        continueAsGuest: 'Continue as guest',
        keepPlanningAsGuest: 'Keep planning as a guest',

        failures: {
            'blank-username': 'Pick a username',
            'no-account': 'No signed-in account to confirm',
        },
    },

    changePasswordForm: {
        title: 'Change password',
        subtitle: 'Choose a new password for your account',

        currentLabel: 'Current password',
        newLabel: 'New password',
        confirmNewLabel: 'Confirm new password',
        confirmNewPlaceholder: 're-enter it',
        forgotCurrent: 'Forgot your current password?',
        submit: 'Update password',

        enterCurrent: 'Enter your current password',
        newTooShort: 'New password must be at least 6 characters',
        newPasswordsDontMatch: 'Those passwords don’t match',
        currentIncorrect: 'Current password is incorrect',

        changedTitle: 'Password changed',
        changedBody: 'Your password has been updated. You’re all set',
        sentBody: (email: string) => `We’ve sent a reset link to ${email}. Open it to set a new one`,
        gotIt: 'Got it',
    },

    changeEmailForm: {
        title: 'Change your email',
        currentlyUsing: (email: string) => `Currently using ${email}`,
        notSet: 'not set',

        newLabel: 'New email',
        newPlaceholder: 'Enter your new email address',
        passwordPlaceholder: 'Enter your password to confirm',
        submit: 'Send confirmation link',
        keepCurrent: 'Keep my current email',

        enterNew: 'Enter the new address',
        notAnEmail: 'That doesn’t look like an email address',
        alreadyYours: 'That is already the address on your account',
        couldNotSend: 'Could not send that. Try again',

        sentTitle: 'Check your inbox',
        openEmailToFinish: 'Open the email and click the link to finish',
        untilConfirmed: (email: string) => `Until you confirm it, you’ll continue signing in with ${email}`,
        emailYouHaveNow: 'the email you have now',
    },

    deleteAccountForm: {
        title: 'Delete your account',
        warning: (weeks: number) => `This permanently deletes your account and ${weeks === 1 ? 'the 1 week' : `all ${weeks} weeks`} saved under it. This cannot be undone`,
        submit: 'Delete my account',
        deleting: 'Deleting…',
        keepAccount: 'Keep my account',
    },

    recoveryScreen: {
        title: 'Choose a new password',
        subtitle: 'Once it’s set, you’ll be signed in',
        submit: 'Set new password',
        cancelling: 'Canceling…',
    },

    signOutPending: {
        title: 'Not everything has synced yet',
        explain: 'Some changes on this device haven’t reached your account yet. If you sign out now, those changes will be lost',
        stay: 'Stay signed in',
        stayNote: 'Syncing will keep trying in the background',
        signOut: 'Sign out anyway',
        signOutNote: 'Lose the unsynced changes',
    },
    guestMerge: {
        eyebrow: 'Welcome back',
        title: 'Unsaved guest work found',

        merge: 'Merge into my plan',
        mergeNote: 'Your guest work will be added to the corresponding weeks in your plan',
        discard: 'Discard guest work',
        discardNote: 'Deletes what you planned as a guest',

        explain: 'You planned some work as a guest before signing in. Merging adds that work to your existing plan, keeping each item in the week you planned it for. Discarding deletes it',

        decideLater: 'Decide later',

        reopenTitle: 'Reopen ended weeks to merge?',
        reopenBody: (weeks: string) => `Some of your guest work belongs to ended weeks (${weeks}). Merging will reopen them`,
        reopenNote: 'Reopened weeks won’t count toward your stats until you end them again',
        reopenConfirm: 'Reopen and merge',
    },

    accountSheet: {
        eyebrow: 'You',

        guideNote: 'A guide on how to plan your week',

        supportNote: 'Chip in to keep beaverplans running',
        signInNote: 'Sync your weeks across devices',
        data: 'Your data',
        dataNote: 'Manage and download your data',

        accountSettings: 'Account settings',
        accountSettingsNote: 'Manage your account details and language',

        signOut: 'Sign out',
        signOutNote: 'Come back anytime to pick up where you left off',
    },

    accountSettings: {
        eyebrow: 'Account',
        title: 'Settings',

        saving: 'Saving…',
        saved: 'Saved',
        couldNotSave: 'Could not save that. Try again',

        changeEmail: 'Change email',
        noEmail: 'Not set',

        passwordSub: 'Change your current password',

        avatar: 'Avatar',
        avatarSub: 'Everyone gets the cat for now',
        soon: 'Soon',
    },

    importDataDialog: {
        title: 'Import your data',
        or: 'or',
        boxLabel: 'Upload a file',
        placeholder: 'Paste here',
        chooseFile: 'Choose a file',
        continueLabel: 'Continue',
        found: (weeks: number) => `${weeks} week${weeks === 1 ? '' : 's'} ready to import`,

        reasons: {
            'not-json': 'This is not valid JSON. Paste your backup, or upload it as a file',
            'not-beaverplans': 'This is not beaverplans data. Use a backup exported from beaverplans',
            malformed: 'This is corrupted, or was made with an older version of beaverplans',
            'too-long': 'A name or a note in this backup is too long to import',
        },

        tooBig: (
            projects: number,
            maxTasks: number,
            maxSubtasks: number,
            limitProjects: number,
            limitTasks: number,
            limitSubtasks: number,
        ) =>
            `This backup is over the limits. One week in it has ${projects} projects (limit ${limitProjects}), up to ${maxTasks} tasks in one project (limit ${limitTasks}), and up to ${maxSubtasks} subtasks in one task (limit ${limitSubtasks})`,
    },

    dataPrivacyDialog: {
        eyebrow: 'Your data',
        title: 'Manage your data',

        nothingStored: 'Nothing stored yet',
        weeksStored: (n: number) => `${n} week${n === 1 ? '' : 's'} stored`,

        download: 'Download as JSON',
        copy: 'Copy as JSON',
        copied: 'Copied',

        importData: 'Import data',

        dangerZone: 'Danger zone',
        deleteData: 'Delete all my data',
        deleteAccount: 'Delete my account',

        manualNote: 'This browser would not let the app write to your clipboard. Select the text below and copy it yourself',
        manualBoxLabel: 'Your data as JSON',
    },

    statsBoard: {
        emptyTitle: 'Nothing to measure yet',
        emptyText: 'Stats are built from ended weeks. End your first week and this fills in',

        avgCompletion: 'Avg completion',
        ofTaskUnits: (done: number, total: number) => `${done} of ${total} task unit${total === 1 ? '' : 's'}`,

        bestWeek: 'Best week',

        weekStreak: 'Week streak',
        inARowAt: (percent: number) => `in a row at ${percent}%+`,
        bestRunWas: (weeks: number) => `best run was ${weeks}`,
        noStreak: 'no streak yet',

        weeksTracked: 'Weeks tracked',
        allTime: 'all-time',

        weekByWeek: 'Week by week',
        weekByWeekNote: 'Bar height is the week’s workload; the fill is what you completed',

        activity: 'Activity',
        activityNote: (units: number) => `${units} task unit${units === 1 ? '' : 's'} completed in the last year`,

        followThrough: 'Follow-through',
        followThroughNote: 'How much of each weekday you finish',
        strongestDay: (day: string, percent: number) => `${day} is your strongest day — ${percent}% of what you plan there gets done`,

        distribution: 'Distribution',
        distributionNote: 'Where each weekday’s finished work lands.',
        busiestDay: (day: string, percent: number) => `${day} is your busiest day — ${percent}% of everything you complete lands there`,
    },

    heatmap: {
        cellUntracked: (date: string) => `${date}: week not tracked`,
        cellUnits: (date: string, units: number) => `${date}: ${units} units`,

        less: 'Less',
        more: 'More',
    },

    weekRef: {
        goTo: (range: string) => `Go to ${range}`,
    },

    weekLabels: {
        thisWeek: 'This week',
        lastWeek: 'Last week',
        nextWeek: 'Next week',

        weeksAgo: (n: number) => `${n} weeks ago`,
        inWeeks: (n: number) => `In ${n} weeks`,
    },

    weekSpark: {
        title: (done: number, assigned: number) => `${done}/${assigned} units`,
    },

    weekTrend: {
        title: (date: string, done: number, total: number) => `${date}: ${done}/${total} units`,

        gapWeeks: (weeks: number) => `${weeks} week${weeks === 1 ? '' : 's'}`,
        gapNotTracked: 'not tracked',
    },

    app: {
        endedNote: (date: string) => `Ended ${date}`,

        weekOverLead: 'This week is over. ',
        weekOverAction: 'End it',
        weekOverRest: ' to update your stats',
        queueOpenLead: '',
        queueOpenRest: ' is an earlier week that’s still open',

        weekPhase: {
            start: () => 'A fresh week — make it yours',
            midweek: (daysLeft: number) => `${daysLeft} days left — keep moving forward`,
            late: (daysLeft: number) => `${daysLeft} days left — make them count`,
            lastDay: () => 'One last day — finish strong',
        } satisfies Record<WeekPhase, (daysLeft: number) => string>,

        emptyNote: 'The week is yours to fill',
        futureNote: 'One step ahead of everyone else',

        moveBlockedHasWork: 'This week already has work in it',

        endWeekEyebrow: 'End week',
        endUnfinishedTitle: 'Some tasks aren’t finished yet',
        clearAllLabel: 'Clear all',
        carryForward: 'Carry forward',
        endUnfinishedBody: 'This finalizes the week and updates your stats. Unfinished tasks can carry forward into next week, or be cleared along with everything else',
        endUnfinishedBodyBlocked: 'This finalizes the week and updates your stats. Next week is already ended, so unfinished tasks will be cleared along with everything else',

        endDoneTitle: 'Everything’s done — nice work',
        endDoneConfirm: 'End week',
        endDoneBody: 'This finalizes the week and updates your stats',

        reopenTitle: 'Rewriting history?',
        reopenConfirm: 'Reopen week',
        reopenBody: 'Ended the week by mistake, or forgot to log something? Reopen it and update anything you missed',

        clearBoardTitle: 'Clear this board?',
        clearBoardConfirm: 'Clear the board',
        clearBoardBody: 'Removes every project on this week. Unlike ending the week, this keeps no record of what was here',

        clearAllTitle: 'Delete every week?',
        clearAllConfirm: 'Delete everything',
        clearAllBody: (n: number) =>
            `This deletes all ${n} of your weeks from the server, planned and ended alike. There is no undo. If you have not taken a copy yet, cancel and do that first`,

        importTitle: 'Replace everything?',
        importConfirm: 'Replace everything',
        importBody: (incoming: number, current: number) =>
            `This file contains ${incoming} week${incoming === 1 ? '' : 's'}. Importing it will replace the ${current} week${current === 1 ? '' : 's'} on your account. A copy of your current data will be downloaded first, so you can restore it if needed`,
    },

    weekHeader: {
        prevWeek: 'Previous week',
        nextWeek: 'Next week',
        prevDestination: 'Earlier destination',
        nextDestination: 'Later destination',

        moveTo: 'Move to',
        today: 'Today',
        todayTitle: 'Jump back to the current week',
        cancelTitle: 'Leave move mode, change nothing',

        moveWork: 'Move work',
        moveToDate: (date: string) => `Move → ${date}`,
        canMove: 'Move this week’s work to another week',
        cannotMove: 'This week’s work cannot be moved',
        pickDestination: 'Pick a week to move this work onto',
        armedHint: 'Pick where to move this week to',
        moveOnto: (range: string) => `Move this week’s work onto ${range}`,
        moveOntoNote: (range: string) => `Move this week’s work onto ${range}.`,
        blocked: (reason: string) => `Cannot move here: ${reason}`,

        endWeek: 'End week',
        reopen: 'Reopen…',
        manage: 'Manage',
    },

    weekActionsSheet: {
        eyebrow: 'Week',

        move: 'Move this week’s work',
        moveNote: 'Move the whole plan onto a different week',

        reopen: 'Reopen this week',
        reopenNote: 'Reopen this week so it can be edited again',

        end: 'End week',
        endNote: 'Finalize this week and carry unfinished tasks forward',

        clear: 'Clear this board',
        clearNote: 'Throw the whole week away without saving it',
        clearNoteEnded: 'An ended week is frozen. Reopen it first, or delete it from the weeks tab',
    },

    weekView: {
        eyebrow: 'This week',

        focusToday: 'Focus today',
        orClickAnyDay: ' · or click any day to focus it',
        clickAnyDay: 'click any day to focus it',
        focusing: 'Focusing ',
        focusingToday: ' (today)',
        showAllDays: 'show all days',

        showCounts: 'Show counts',
        showProgress: 'Show progress',
        taskCount: (n: number) => `${n} task${n === 1 ? '' : 's'}`,
    },

    weekWelcome: {
        titleProject: 'Let’s plan your week',
        titleTask: (project: string) => `What do you want to do for ${project}?`,
        titleDays: 'How will you get it done?',
        subProject: 'Three steps, and your plans become daily to-dos',
        subTask: 'Choose what you want to get done this week',
        subDays: 'Rate each by difficulty. Harder work counts for more',

        stepProject: 'Make a project',
        stepProjectBody: 'Something you’re working on this week, like a course, project, or pursuit',
        stepProjectSample: 'Linear Algebra',
        stepTask: 'Add a task',
        stepTaskBody: 'A piece of work you want to complete as part of this project',
        stepTaskSample: 'read chapter 3',
        stepDays: 'Break it into subtasks',
        stepDaysBody: 'Break the task into smaller pieces and spread them across the days you’ll work',

        ctaProject: 'Add a project',
        ctaTask: 'Add a task',
        ctaDays: 'Pick days for the task',

        quietTitle: 'Nothing scheduled yet',
        quietBody: 'Your planned work will show up here',

        getStarted: 'Get started',
        skip: 'Skip guide',

        stepsLabel: 'Getting started',
        stepDone: 'done',
    },

    dayColumn: {
        focusDay: 'Focus this day',
        dueList: (names: string) => `Due: ${names}`,
    },

    focusedDay: {
        today: ' · today',
        doneOf: (done: number, assigned: number) => `${done} of ${assigned} done`,
        nothingScheduled: 'nothing scheduled',
        empty: 'No tasks on this day',
        due: (names: string) => `Due · ${names}`,
    },

    dayCell: {
        weightOf: (weight: number) => `weight ${weight} of 3`,

        missed: 'missed',
        nowOn: (day: string) => ` · now on ${day}`,
        clearMissedLabel: 'Clear this missed mark',
        clearMissedTitle: 'Clear missed',
        clear: 'Clear',

        overdue: 'overdue',
        reschedule: ' · reschedule?',
        move: 'Move to another day',
        moveShort: 'Move',
    },

    movePopover: {
        moveTo: 'Move to',
        railLabel: 'Move to which day',
        currentDay: 'Currently on this day',
        markMissed: (day: string) => `Mark ${day} as missed`,
        move: 'Move',
    },

    weekBoard: {
        clearMissedTitle: 'Clear this missed day?',
        clearMissedConfirm: 'Clear',
        clearMissedBody: (day: string) => `${day} will no longer count as a missed day for this subtask`,

        deleteProjectTitle: (name: string) => `Delete project "${name}"?`,
        deleteTaskTitle: (name: string) => `Delete task "${name}"?`,
        deleteProjectBody: (tasks: number) => `This will permanently delete the project and its ${tasks} task${tasks === 1 ? '' : 's'}`,
        deleteTaskBody: (subtasks: number) => `This will permanently delete the task and its ${subtasks} subtask${subtasks === 1 ? '' : 's'}`,

        copyTitle: (range: string) => `Copy ${range}`,
    },
};

export type Catalog = typeof en;
