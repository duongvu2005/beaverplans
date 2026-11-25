import type { Catalog } from './en';

export const vi: Catalog = {
    common: {
        cancel: 'Huỷ',
        save: 'Lưu',
        close: 'Đóng',
        delete: 'Xoá',
        done: 'Xong',
        back: 'Quay trở lại',

        doneOf: (done: number, total: number) => `đã xong ${done}/${total}`,

        dueCount: (n: number) => `${n} việc đến hạn`,

        untitled: 'Chưa đặt tên',
        projectFallback: 'Dự án',
        taskFallback: 'Công việc',

        weights: {
            easy: 'Dễ',
            medium: 'Vừa',
            hard: 'Khó',
        },
    },

    projectView: {
        eyebrow: 'Dự án',
        copyPlan: 'Chép kế hoạch',
        pastePlan: 'Dán kế hoạch',
    },

    projectList: {
        addProject: '+ thêm dự án',
        projectLimit: (limit: number) => `${limit} dự án mỗi tuần`,
    },

    projectCard: {
        dragProject: 'Kéo để sắp xếp lại dự án',
        namePlaceholder: 'Tên dự án…',
        setDeadline: 'Đặt hạn chót',
        deleteProject: 'Xoá dự án',
        addTask: 'thêm công việc',
        taskLimit: (limit: number) => `${limit} công việc mỗi dự án`,
    },

    taskRow: {
        dragTitle: 'Kéo để sắp xếp lại, hoặc chuyển sang dự án khác',
        dragLabel: 'Kéo để sắp xếp lại công việc',
        namePlaceholder: 'Công việc…',
        assignTitle: 'Chọn những ngày sẽ làm việc này',
        assignDays: 'chọn ngày',
        editTask: 'Chỉnh sửa công việc',
        editTitle: 'Chọn ngày / chia nhỏ / hạn chót',
        deleteTask: 'Xoá công việc',
    },

    subtaskRow: {
        dragTitle: 'Kéo để sắp xếp lại, hoặc chuyển sang ngày khác',
        dragLabel: 'Kéo để sắp xếp lại việc con',
        notePlaceholder: 'thêm ghi chú (không bắt buộc)',
        removeLabel: 'Xoá việc con',
        removeTitle: 'Xoá',
    },

    projectEditor: {
        eyebrow: 'Dự án',
        deadline: 'Hạn chót',
        clear: 'Xoá',
    },

    taskEditor: {
        deadline: 'Hạn chót',
        clear: 'Xoá',
        days: 'Ngày',
        daysLabel: 'Những ngày sẽ làm công việc này',
        addSubtaskOn: (day: string) => `+ thêm việc con vào ${day}`,
        subtaskLimit: (limit: number) => `Mỗi công việc nhiều nhất ${limit} việc con. Bỏ bớt một việc con để thêm việc con mới.`,
        daysHint: 'Dùng các chấm để chọn độ khó. Việc khó hơn sẽ tính nhiều hơn vào tiến độ',
        note: 'Ghi chú',
        notePlaceholder: 'ghi chú về toàn bộ công việc (không bắt buộc)',
    },

    weightChip: {
        title: 'Hệ số',
        titleOf: (label: string) => `Hệ số — ${label}`,
        weightOf: (name: string) => `Hệ số: ${name}`,
        hint: 'Việc con càng khó thì hệ số cho tiến độ càng lớn',
        counts: (multiplier: string) => `${multiplier}`,
    },

    weightDots: {
        label: 'Hệ số',
    },

    pastePlanDialog: {
        title: 'Dán một kế hoạch',
        intro: 'Thêm dự án từ tuần khác',
        placeholder: 'Dán vào đây',
        boxLabel: 'Dán một kế hoạch đã được sao chép',
        add: 'Thêm vào tuần này',

        reasons: {
            'not-json': 'Đây không giống một kế hoạch đã được sao chép. Hãy sao chép một kế hoạch từ bất kỳ tuần nào rồi thử lại',
            'not-beaverplans': 'Đây không phải là kế hoạch đã được sao chép. Nếu bạn muốn dán toàn bộ bản sao lưu, đó là một tệp khác và không thể thêm vào một tuần riêng lẻ',
            malformed: 'Bản sao này có thể đã bị hỏng hoặc được tạo bằng phiên bản beaverplans cũ hơn',
            'too-long': 'Có một phần tên hoặc ghi chú trong bản sao này bị quá dài. Hãy sửa lại chúng cho ngắn hơn rồi thử lại',
        },

        tooBig: (projects: number, maxTasks: number, maxSubtasks: number, limitProjects: number, limitTasks: number, limitSubtasks: number) => `Bản sao này quá lớn cho một tuần. Nó có ${projects} dự án (giới hạn ${limitProjects}), nhiều nhất ${maxTasks} công việc trong một dự án (giới hạn ${limitTasks}) và ${maxSubtasks} việc con trong một công việc (giới hạn ${limitSubtasks}).`,

        found: (projects: number, tasks: number, range: string) => `${projects} dự án, ${tasks} công việc, sao chép từ ${range}.`,
        tooMany: (found: number, room: number, limit: number) => `Có ${found} dự án, nhưng tuần này chỉ còn chỗ cho ${room} dự án. Mỗi tuần được có tối đa ${limit} dự án.`,

        keepProgress: 'Giữ tiến độ hoàn thành',
        keepHint: 'Nếu tắt, tiến độ hoàn thành và các ngày bị bỏ lỡ sẽ không được giữ lại',
    },

    weekList: {
        eyebrow: 'Tuần',

        emptyTitle: 'Chưa có tuần nào',
        emptyText: 'Các tuần bạn lên kế hoạch sẽ nằm ở đây',

        weekCount: (n: number) => `${n} tuần`,
        clearAll: 'Xoá hết',

        upcomingWeeks: (n: number) => `${n} tuần sắp tới`,
        expand: 'Xem các tuần sắp tới',
        collapse: 'Ẩn các tuần sắp tới',

        copyTitle: (range: string) => `Sao chép ${range}`,

        deleteTitle: (range: string) => `Xoá ${range}?`,
        deleteBody: 'Tuần này sẽ bị xoá vĩnh viễn, bao gồm tất cả các dự án và công việc',

        clearAllTitle: 'Xoá mọi tuần?',
        clearAllConfirm: 'Xoá tất cả',
        clearAllBody: (n: number) => `Toàn bộ ${n} tuần cùng tất cả dữ liệu thống kê liên quan sẽ bị xoá vĩnh viễn`,
    },

    weekRow: {
        open: (range: string) => `Mở tuần ${range}`,
        complete: 'hoàn thành',
        done: 'đã xong',
        planned: 'dự kiến',
        thisWeek: 'tuần này',
        upcoming: 'sắp tới',
        notEnded: 'chưa kết thúc',
        copy: (range: string) => `Sao chép tuần ${range}`,
        remove: (range: string) => `Xoá tuần ${range}`,
    },

    weekQuickLook: {
        eyebrow: 'Tuần',
        empty: 'Tuần này chưa có nội dung nào',
        missed: (n: number) => `lỡ ${n} ngày`,
        view: 'Xem',
    },

    topBar: {
        views: {
            plan: 'Kế hoạch',
            stats: 'Thống kê',
            weeks: 'Lịch tuần',
        },

        support: 'Ủng hộ',
        supportTitle: 'Ủng hộ dự án này',

        guest: 'Khách',
        signIn: 'Đăng nhập',

        account: 'Tài khoản',
        accountOf: (username: string, email: string | undefined) => `Tài khoản: ${username}${email === undefined ? '' : ` (${email})`}`,
    },

    crashScreen: {
        appTitle: 'beaverplans gặp sự cố',
        appBody: 'Đã xảy ra lỗi khi tải trang này. Kế hoạch của bạn vẫn an toàn — hãy thử tải lại để khắc phục sự cố',

        viewTitle: 'Không mở được thẻ này',
        viewBody: 'Đã có lỗi khi hiển thị thẻ này. Kế hoạch của bạn vẫn an toàn — hãy thử tải lại để khắc phục sự cố',

        offerCopy: 'Nếu muốn có thêm một bản sao lưu, bạn có thể tải xuống một bản sao của kế hoạch ngay bây giờ',
        download: 'Tải một bản sao',
        reload: 'Tải lại beaverplans',
    },

    confirmDialog: {
        typeToConfirmLead: 'Nhập ',
        typeToConfirmRest: ' để xác nhận',
        confirm: 'Xác nhận',
    },

    copyPlanDialog: {
        copy: 'Chép',
        empty: 'Tuần này không có dự án nào để sao chép',
        projects: 'Dự án',
        selectAll: 'Chọn hết',
        deselectAll: 'Bỏ chọn hết',

        taskCount: (n: number) => `${n} công việc`,
        projectLabel: (name: string, tasks: string) => `${name}, ${tasks}`,
    },

    copyTextDialog: {
        title: 'Tự chép bằng tay',
        body: 'Trình duyệt này không cho ứng dụng ghi vào bộ nhớ tạm. Hãy bôi đen đoạn văn bản bên dưới rồi chép lại',
        boxLabel: 'Kế hoạch đã chép, dạng văn bản',
    },

    languagePicker: {
        label: 'Ngôn ngữ',

        english: 'English',
        vietnamese: 'Tiếng Việt',

        choose: (name: string) => `Chuyển sang ${name}`,
    },

    themePicker: {
        label: 'Giao diện',

        options: {
            light: 'Sáng',
            dark: 'Tối',
            system: 'Tự động',
        },
    },

    fontPicker: {
        label: 'Phông chữ',

        options: {
            modern: 'Hiện đại',
            classic: 'Cổ điển',
        },
    },

    guideToggle: {
        label: 'Hướng dẫn',
    },

    authForm: {
        titles: {
            signin: 'Đăng nhập',
            signup: 'Tạo tài khoản',
            reset: 'Đặt lại mật khẩu',
        },
        subtitles: {
            signin: 'Chào mừng bạn quay trở lại',
            signup: 'Tuần của bạn, trên mọi thiết bị bạn dùng',
            reset: 'Chúng tôi sẽ gửi email kèm liên kết đặt lại',
        },
        submits: {
            signin: 'Đăng nhập',
            signup: 'Tạo tài khoản',
            reset: 'Gửi email đặt lại mật khẩu',
        },
        switches: {
            signin: { prompt: 'Chưa có tài khoản?', action: 'Tạo tài khoản' },
            signup: { prompt: 'Đã có rồi?', action: 'Đăng nhập' },
            reset: { prompt: 'Nhớ ra rồi?', action: 'Quay lại đăng nhập' },
        },

        passwordLabel: 'Mật khẩu',
        atLeast6: 'ít nhất 6 ký tự',
        showPassword: 'Hiện mật khẩu',
        hidePassword: 'Ẩn mật khẩu',
        humanFirst: 'Hãy xác nhận bạn không phải máy trước đã',
        somethingWrong: 'Có gì đó không ổn. Thử lại sau ít phút nhé',
        oneMoment: 'Đợi một chút…',
        sending: 'Đang gửi…',
        backToWeek: 'Quay lại tuần của bạn',
        checkYourEmail: 'Kiểm tra email của bạn',
        sentLinkTo: 'Chúng tôi đã gửi liên kết xác nhận tới',
        enterPasswordToConfirm: 'Nhập mật khẩu để xác nhận',
        passwordIncorrect: 'Mật khẩu không đúng',

        emailLabel: 'Email',
        emailPlaceholder: 'you@example.com',
        usernameLabel: 'Tên hiển thị',
        usernamePlaceholder: 'chúng tôi nên gọi bạn là gì?',
        confirmPasswordLabel: 'Xác nhận mật khẩu',
        forgotPassword: 'Quên mật khẩu?',

        enterEmail: 'Hãy nhập email của bạn',
        pickUsername: 'Hãy chọn một tên hiển thị',
        enterPassword: 'Hãy nhập mật khẩu của bạn',
        passwordTooShort: 'Mật khẩu phải có ít nhất 6 ký tự',
        passwordsDontMatch: 'Hai mật khẩu không khớp',
        resetLinkSent: 'Nếu email đó có tài khoản, liên kết đặt lại mật khẩu đang trên đường gửi đến',

        openLinkToFinish: 'Mở liên kết đó để hoàn tất việc tạo tài khoản. Bạn sẽ tự động được đăng nhập',
        resendSent: 'Đã gửi. Nếu bạn vẫn chưa thấy, hãy kiểm tra hộp thư rác nhé',
        resendArmed: 'Hãy xác nhận bạn không phải máy rồi thử lại',
        resendFailed: 'Chưa gửi được lúc này. Hãy thử lại nhé',
        sendAgain: 'Gửi lại',
        sendAgainIn: (seconds: number) => `Gửi lại sau ${seconds}s`,
        useDifferentEmail: 'Dùng email khác',

        continueAsGuest: 'Tiếp tục với tư cách khách',
        keepPlanningAsGuest: 'Tiếp tục lên kế hoạch với tư cách khách',

        failures: {
            'blank-username': 'Hãy chọn một tên hiển thị',
            'no-account': 'Không có tài khoản đã đăng nhập nào để xác nhận',
        },
    },

    changePasswordForm: {
        title: 'Đổi mật khẩu',
        subtitle: 'Chọn mật khẩu mới cho tài khoản của bạn',

        currentLabel: 'Mật khẩu hiện tại',
        newLabel: 'Mật khẩu mới',
        confirmNewLabel: 'Xác nhận mật khẩu mới',
        confirmNewPlaceholder: 'nhập lại lần nữa',
        forgotCurrent: 'Quên mật khẩu hiện tại?',
        submit: 'Cập nhật mật khẩu',

        enterCurrent: 'Hãy nhập mật khẩu hiện tại của bạn',
        newTooShort: 'Mật khẩu mới phải có ít nhất 6 ký tự',
        newPasswordsDontMatch: 'Hai mật khẩu không khớp',
        currentIncorrect: 'Mật khẩu hiện tại không đúng',

        changedTitle: 'Đã đổi mật khẩu',
        changedBody: 'Mật khẩu của bạn đã được cập nhật',
        sentBody: (email: string) => `Chúng tôi đã gửi liên kết đặt lại tới ${email}. Mở nó ra để đặt mật khẩu mới.`,
        gotIt: 'Đã hiểu',
    },

    changeEmailForm: {
        title: 'Đổi email của bạn',
        currentlyUsing: (email: string) => `Đang dùng ${email}.`,
        notSet: 'chưa đặt',

        newLabel: 'Email mới',
        newPlaceholder: 'Nhập địa chỉ email mới của bạn',
        passwordPlaceholder: 'Nhập mật khẩu để xác nhận',
        submit: 'Gửi liên kết xác nhận',
        keepCurrent: 'Giữ email hiện tại',

        enterNew: 'Hãy nhập địa chỉ mới',
        notAnEmail: 'Địa chỉ email không hợp lệ',
        alreadyYours: 'Đây đã là email trên tài khoản của bạn rồi',
        couldNotSend: 'Chưa gửi được. Thử lại nhé',

        sentTitle: 'Kiểm tra hộp thư của bạn',
        openEmailToFinish: 'Mở email và bấm vào liên kết để hoàn tất',
        untilConfirmed: (email: string) => `Cho tới khi bạn xác nhận, bạn sẽ tiếp tục đăng nhập bằng ${email}.`,
        emailYouHaveNow: 'email bạn đang dùng',
    },

    deleteAccountForm: {
        title: 'Xoá tài khoản của bạn',
        warning: (weeks: number) => `Thao tác này xoá vĩnh viễn tài khoản của bạn và toàn bộ ${weeks} được lưu trên mọi thiết bị. Không thể hoàn tác`,
        submit: 'Xoá tài khoản của tôi',
        deleting: 'Đang xoá…',
        keepAccount: 'Giữ tài khoản của tôi',
    },

    recoveryScreen: {
        title: 'Chọn mật khẩu mới',
        subtitle: 'Sau khi thiết lập xong, bạn sẽ được đăng nhập',
        submit: 'Đặt mật khẩu mới',
        cancelling: 'Đang huỷ…',
    },

    signOutPending: {
        title: 'Một số thay đổi chưa được đồng bộ',
        explain: 'Một số thay đổi trên thiết bị này chưa được lưu vào tài khoản của bạn. Nếu đăng xuất bây giờ, bạn sẽ mất những thay đổi đó',
        stay: 'Ở lại và tiếp tục đồng bộ',
        stayNote: 'Duy trì đăng nhập',
        signOut: 'Vẫn đăng xuất',
        signOutNote: 'Bạn sẽ mất các thay đổi chưa được đồng bộ',
    },
    guestMerge: {
        eyebrow: 'Chào mừng bạn quay trở lại',
        title: 'Tìm thấy kế hoạch chưa lưu',

        merge: 'Thêm vào kế hoạch',
        mergeNote: 'Các kế hoạch bạn đã tạo sẽ được thêm vào đúng tuần bạn đã chọn trước khi đăng nhập',
        discard: 'Bỏ phần việc đó',
        discardNote: 'Xoá những gì bạn đã viết khi chưa đăng nhập',

        explain: 'Bạn đã lên một số kế hoạch khi chưa đăng nhập. Nếu bạn gộp, mỗi kế hoạch sẽ được thêm vào đúng tuần của nó, cùng với những gì đã có trong tuần đó',

        decideLater: 'Để sau',

        reopenTitle: 'Mở lại các tuần đã kết thúc để gộp?',
        reopenBody: (weeks: string) => `Một phần công việc bạn đã lên kế hoạch khi chưa đăng nhập thuộc về các tuần bạn đã kết thúc (${weeks}). Thêm phần công việc này vào kế hoạch của bạn sẽ mở lại các tuần này`,
        reopenNote: 'Các tuần được mở lại sẽ tạm thời không được tính vào thống kê cho đến khi bạn kết thúc lại',
        reopenConfirm: 'Mở lại và gộp',
    },

    accountSheet: {
        eyebrow: 'Bạn',

        guideNote: 'Hướng dẫn lên kế hoạch cho tuần',

        supportNote: 'Đóng góp để giúp beaverplans tiếp tục hoạt động',
        signInNote: 'Đồng bộ các tuần của bạn giữa các thiết bị',
        data: 'Dữ liệu của bạn',
        dataNote: 'Quản lý dữ liệu của bạn',

        accountSettings: 'Cài đặt tài khoản',
        accountSettingsNote: 'Quản lý thông tin tài khoản và ngôn ngữ',

        signOut: 'Đăng xuất',
        signOutNote: 'Bạn có thể quay lại bất cứ lúc nào để tiếp tục',
    },

    accountSettings: {
        eyebrow: 'Tài khoản',
        title: 'Cài đặt',

        saving: 'Đang lưu…',
        saved: 'Đã lưu',
        couldNotSave: 'Chưa lưu được. Thử lại nhé',

        changeEmail: 'Đổi email',
        noEmail: 'Chưa đặt',

        passwordSub: 'Thay đổi mật khẩu của bạn',

        avatar: 'Ảnh đại diện',
        avatarSub: 'Tạm thời ai cũng là mèo nha',
        soon: 'Sắp có',
    },

    importDataDialog: {
        title: 'Nhập dữ liệu của bạn',
        or: 'hoặc',
        boxLabel: 'Tải bản sao lưu',
        placeholder: 'Dán vào đây',
        chooseFile: 'Chọn tệp',
        continueLabel: 'Tiếp tục',
        found: (weeks: number) => `${weeks} tuần sẵn sàng để nhập`,

        reasons: {
            'not-json': 'Đây không phải JSON hợp lệ. Hãy dán hoặc tải bản sao lưu của bạn lên',
            'not-beaverplans': 'Đây không phải dữ liệu từ beaverplans. Hãy dùng bản sao lưu từ đây',
            malformed: 'Dữ liệu bị hỏng, hoặc được tạo bằng phiên bản beaverplans cũ hơn',
            'too-long': 'Một tên hoặc ghi chú trong bản sao lưu này quá dài để nhập',
        },

        tooBig: (
            projects: number,
            maxTasks: number,
            maxSubtasks: number,
            limitProjects: number,
            limitTasks: number,
            limitSubtasks: number,
        ) =>
            `Bản sao lưu này vượt quá giới hạn. Một tuần trong đó có ${projects} dự án (giới hạn ${limitProjects}), tối đa ${maxTasks} nhiệm vụ trong một dự án (giới hạn ${limitTasks}), và tối đa ${maxSubtasks} nhiệm vụ con trong một nhiệm vụ (giới hạn ${limitSubtasks})`,
    },

    dataPrivacyDialog: {
        eyebrow: 'Dữ liệu của bạn',
        title: 'Quản lý dữ liệu của bạn',

        nothingStored: 'Chưa có dữ liệu',
        weeksStored: (n: number) => `Đã lưu ${n} tuần`,

        download: 'Tải về dạng JSON',
        copy: 'Sao chép dạng JSON',
        copied: 'Đã sao chép',

        importData: 'Nhập dữ liệu',

        dangerZone: 'Khu vực nguy hiểm',
        deleteData: 'Xoá toàn bộ dữ liệu',
        deleteAccount: 'Xoá tài khoản',

        manualNote: 'Trình duyệt này không cho phép ứng dụng sao chép vào bộ nhớ tạm. Hãy sao chép phần văn bản bên dưới',
        manualBoxLabel: 'Dữ liệu của bạn ở dạng JSON',
    },

    statsBoard: {
        emptyTitle: 'Chưa có gì để thống kê',
        emptyText: 'Thống kê được tính từ những tuần đã kết thúc. Hãy kết thúc tuần đầu tiên để xem thống kê',

        avgCompletion: 'Tỷ lệ hoàn thành',
        ofTaskUnits: (done: number, total: number) => `${done} trên ${total} việc`,

        bestWeek: 'Tuần tốt nhất',

        weekStreak: 'Chuỗi tuần',
        inARowAt: (percent: number) => `liên tiếp đạt ${percent}%+`,
        bestRunWas: (weeks: number) => `chuỗi dài nhất là ${weeks}`,
        noStreak: 'chưa có chuỗi nào',

        weeksTracked: 'Tuần đã theo dõi',
        allTime: 'từ trước tới nay',

        weekByWeek: 'Từng tuần',
        weekByWeekNote: 'Chiều cao cột là khối lượng của tuần; phần tô đậm là những gì bạn đã làm xong',

        activity: 'Hoạt động',
        activityNote: (units: number) => `${units} việc đã hoàn thành trong năm qua`,

        followThrough: 'Mức độ hoàn thành',
        followThroughNote: 'Mỗi thứ trong tuần bạn làm xong được bao nhiêu',
        strongestDay: (day: string, percent: number) => `${day} là ngày bạn làm tốt nhất — ${percent}% số việc bạn xếp vào đó được làm xong.`,

        distribution: 'Phân bố',
        distributionNote: 'Những việc bạn làm xong rơi vào thứ nào trong tuần',
        busiestDay: (day: string, percent: number) => `${day} là ngày bận rộn nhất — ${percent}% tổng số việc bạn hoàn thành rơi vào ngày đó.`,
    },

    heatmap: {
        cellUntracked: (date: string) => `${date}: tuần không được theo dõi`,
        cellUnits: (date: string, units: number) => `${date}: ${units} việc`,

        less: 'Ít',
        more: 'Nhiều',
    },

    weekRef: {
        goTo: (range: string) => `Đi tới ${range}`,
    },

    weekLabels: {
        thisWeek: 'Tuần này',
        lastWeek: 'Tuần trước',
        nextWeek: 'Tuần sau',

        weeksAgo: (n: number) => `${n} tuần trước`,
        inWeeks: (n: number) => `${n} tuần nữa`,
    },

    weekSpark: {
        title: (done: number, assigned: number) => `${done}/${assigned} việc`,
    },

    weekTrend: {
        title: (date: string, done: number, total: number) => `${date}: ${done}/${total} việc`,

        gapWeeks: (weeks: number) => `${weeks} tuần`,
        gapNotTracked: 'không theo dõi',
    },

    app: {
        endedNote: (date: string) => `Đã kết thúc ${date}`,

        weekOverLead: 'Tuần này đã qua. ',
        weekOverAction: 'Kết thúc tuần',
        weekOverRest: ' để cập nhật thống kê',
        queueOpenLead: 'Tuần ',
        queueOpenRest: ' trước đó vẫn chưa kết thúc',

        weekPhase: {
            start: () => 'Một tuần mới, một khởi đầu mới',
            midweek: (daysLeft: number) => `Còn ${daysLeft} ngày, tiếp tục cố gắng nhé`,
            late: (daysLeft: number) => `Còn ${daysLeft} ngày, cố thêm một chút nữa thôi`,
            lastDay: () => 'Hoàn thành thật trọn vẹn ngày cuối tuần nhé',
        },

        emptyNote: 'Tuần này vẫn còn chờ bạn viết tiếp',
        futureNote: 'Luôn đi trước một bước',

        moveBlockedHasWork: 'Tuần này đã có kế hoạch',

        endWeekEyebrow: 'Kết thúc tuần',
        endUnfinishedTitle: 'Còn công việc chưa xong',
        clearAllLabel: 'Xoá',
        carryForward: 'Chuyển sang tuần sau',
        endUnfinishedBody: 'Tuần này sẽ được chốt và số liệu thống kê sẽ được cập nhật. Bạn có thể xoá hoặc chuyển các công việc chưa hoàn thành sang tuần sau',
        endUnfinishedBodyBlocked: 'Tuần này sẽ được chốt và số liệu thống kê sẽ được cập nhật. Vì tuần sau đã kết thúc, các công việc chưa hoàn thành sẽ bị xoá',

        endDoneTitle: 'Xong hết rồi — làm tốt lắm!',
        endDoneConfirm: 'Kết thúc tuần',
        endDoneBody: 'Tuần này sẽ được chốt và số liệu thống kê sẽ được cập nhật',

        reopenTitle: 'Sửa lại tuần này?',
        reopenConfirm: 'Mở lại tuần',
        reopenBody: 'Bạn lỡ kết thúc tuần hoặc chưa kịp lưu dữ liệu? Hãy mở lại tuần để cập nhật và chỉnh sửa cho chính xác',

        clearBoardTitle: 'Xoá kế hoạch tuần này?',
        clearBoardConfirm: 'Xoá kế hoạch',
        clearBoardBody: 'Xoá mọi dự án trong tuần này. Không ảnh hưởng các tuần khác của bạn',

        clearAllTitle: 'Xoá mọi tuần?',
        clearAllConfirm: 'Xoá tất cả',
        clearAllBody: (n: number) =>
            `Thao tác này sẽ xoá toàn bộ ${n} tuần của bạn khỏi máy chủ, bao gồm cả các tuần đã lên kế hoạch và các tuần đã kết thúc. Không thể hoàn tác. Nếu bạn chưa lưu bản sao, hãy huỷ và làm việc đó trước`,

        importTitle: 'Thay thế toàn bộ?',
        importConfirm: 'Thay thế toàn bộ',
        importBody: (incoming: number, current: number) =>
            `Tệp này chứa ${incoming} tuần. Tệp này sẽ thay thế ${current} tuần trên tài khoản của bạn. Một bản sao của dữ liệu hiện tại sẽ được tải về trước để bạn có thể khôi phục nếu cần`,
    },

    weekHeader: {
        prevWeek: 'Tuần trước',
        nextWeek: 'Tuần sau',
        prevDestination: 'Đích đến sớm hơn',
        nextDestination: 'Đích đến muộn hơn',

        moveTo: 'Chuyển đến',
        today: 'Hôm nay',
        todayTitle: 'Về lại tuần hiện tại',
        cancelTitle: 'Thoát chế độ chuyển, không đổi gì',

        moveWork: 'Chuyển việc',
        moveToDate: (date: string) => `Chuyển → ${date}`,
        canMove: 'Chuyển việc của tuần này sang tuần khác',
        cannotMove: 'Không thể chuyển việc của tuần này',
        pickDestination: 'Chọn tuần để chuyển việc này sang',
        armedHint: 'Chọn tuần mới cho kế hoạch này ở phía trên',
        moveOnto: (range: string) => `Chuyển việc của tuần này sang ${range}`,
        moveOntoNote: (range: string) => `Chuyển việc của tuần này sang ${range}.`,
        blocked: (reason: string) => `Không chuyển được sang đây: ${reason}`,

        endWeek: 'Kết thúc tuần',
        reopen: 'Mở lại…',
        manage: 'Quản lý',
    },

    weekActionsSheet: {
        eyebrow: 'Tuần',

        move: 'Chuyển tuần của kế hoạch này',
        moveNote: 'Gán lại toàn bộ kế hoạch sang một tuần khác',

        reopen: 'Mở lại tuần này',
        reopenNote: 'Mở lại tuần này để chỉnh sửa lại',

        end: 'Kết thúc tuần',
        endNote: 'Chốt tuần này và chuyển việc chưa xong qua tuần sau',

        clear: 'Xoá kế hoạch tuần này',
        clearNote: 'Bỏ kế hoạch cả tuần đi mà không lưu lại',
        clearNoteEnded: 'Tuần đã kết thúc thì không sửa được. Hãy mở lại nó trước, hoặc xoá nó ở thẻ lịch tuần',
    },

    weekView: {
        eyebrow: 'Tuần này',

        focusToday: 'Xem hôm nay',
        orClickAnyDay: ' · hoặc chọn một ngày bất kỳ để xem riêng',
        clickAnyDay: 'bấm vào một ngày nào đó để xem riêng',
        focusing: 'Đang xem riêng ',
        focusingToday: ' (hôm nay)',
        showAllDays: 'hiện tất cả các ngày',

        showCounts: 'Hiện số lượng',
        showProgress: 'Hiện tiến độ',
        taskCount: (n: number) => `${n} việc`,
    },

    weekWelcome: {
        titleProject: 'Cùng lên kế hoạch cho tuần này',
        titleTask: (project: string) => `Bạn muốn làm gì cho ${project}?`,
        titleDays: 'Bạn sẽ hoàn thành nó như thế nào?',
        subProject: 'Biến điều bạn muốn làm thành việc cụ thể mỗi ngày',
        subTask: 'Chọn những việc bạn muốn làm tuần này',
        subDays: 'Việc con khó hơn sẽ có hệ số cao hơn',

        stepProject: 'Tạo một dự án',
        stepProjectBody: 'Một thứ bạn muốn dành thời gian trong tuần này, như môn học, dự án, sở thích',
        stepProjectSample: 'Đại số tuyến tính',
        stepTask: 'Thêm một công việc',
        stepTaskBody: 'Một phần việc bạn muốn hoàn thành trong dự án này',
        stepTaskSample: 'đọc chương 3',
        stepDays: 'Chia thành các việc nhỏ',
        stepDaysBody: 'Chia việc đó thành những phần nhỏ để làm trong từng ngày',

        ctaProject: 'Tạo một dự án',
        ctaTask: 'Thêm công việc',
        ctaDays: 'Chọn ngày cho công việc',

        quietTitle: 'Chưa có kế hoạch nào',
        quietBody: 'Kế hoạch của bạn sẽ hiện ở đây',

        getStarted: 'Bắt đầu',
        skip: 'Bỏ qua hướng dẫn',

        stepsLabel: 'Bắt đầu',
        stepDone: 'đã xong',
    },

    dayColumn: {
        focusDay: 'Xem riêng ngày này',
        dueList: (names: string) => `Đến hạn: ${names}`,
    },

    focusedDay: {
        today: ' · hôm nay',
        doneOf: (done: number, assigned: number) => `đã xong ${done}/${assigned}`,
        nothingScheduled: 'chưa xếp việc nào',
        empty: 'Ngày này không có việc nào',
        due: (names: string) => `Đến hạn · ${names}`,
    },

    dayCell: {
        weightOf: (weight: number) => `hệ số ${weight} trên 3`,

        missed: 'đã lỡ',
        nowOn: (day: string) => ` · giờ ở ${day}`,
        clearMissedLabel: 'Bỏ đánh dấu lỡ này',
        clearMissedTitle: 'Bỏ đánh dấu lỡ',
        clear: 'Bỏ',

        overdue: 'muộn',
        reschedule: ' · xếp lại?',
        move: 'Chuyển sang ngày khác',
        moveShort: 'Chuyển',
    },

    movePopover: {
        moveTo: 'Chuyển sang',
        railLabel: 'Chuyển sang ngày nào',
        currentDay: 'Đang ở ngày này',
        markMissed: (day: string) => `Đánh dấu ${day} là lỡ`,
        move: 'Chuyển',
    },

    weekBoard: {
        clearMissedTitle: 'Bỏ dấu lỡ của ngày này?',
        clearMissedConfirm: 'Bỏ',
        clearMissedBody: (day: string) => `${day} sẽ không còn tính là ngày lỡ cho việc con này.`,

        deleteProjectTitle: (name: string) => `Xoá dự án "${name}"?`,
        deleteTaskTitle: (name: string) => `Xoá công việc "${name}"?`,
        deleteProjectBody: (tasks: number) => `Dự án và ${tasks} công việc trong đó sẽ bị xoá vĩnh viễn.`,
        deleteTaskBody: (subtasks: number) => `Công việc và ${subtasks} việc con trong đó sẽ bị xoá vĩnh viễn.`,

        copyTitle: (range: string) => `Sao chép ${range}`,
    },
};
