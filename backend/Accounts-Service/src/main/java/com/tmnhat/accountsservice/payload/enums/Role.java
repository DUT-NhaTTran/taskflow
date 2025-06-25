package com.tmnhat.accountsservice.payload.enums;

public enum Role {
    // Hệ thống
    USER,        // người dùng hệ thống
    ADMIN,       // quản trị hệ thống

    // Trong project
    PROJECT_LEAD,     // người tạo project
    PROJECT_ADMIN,    // quản trị project
    PROJECT_DEVELOPER,// dev thực thi
    PROJECT_REPORTER, // người báo cáo issue
    PROJECT_VIEWER    // chỉ xem
}
