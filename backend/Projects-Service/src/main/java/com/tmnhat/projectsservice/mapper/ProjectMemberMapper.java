package com.tmnhat.projectsservice.mapper;

import com.tmnhat.projectsservice.model.ProjectMembers;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.UUID;

public class ProjectMemberMapper {
    public static ProjectMembers mapResultSetToProjectMember(ResultSet rs) throws SQLException {
        return new ProjectMembers.Builder()
                .id(rs.getObject("id", UUID.class))
                .projectId(rs.getObject("project_id", UUID.class))
                .userId(rs.getObject("user_id", UUID.class))
                .roleInProject(rs.getString("role_in_project"))
                .build();
    }
}
