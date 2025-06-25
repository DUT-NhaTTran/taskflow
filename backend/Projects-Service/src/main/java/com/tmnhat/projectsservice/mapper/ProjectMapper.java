package com.tmnhat.projectsservice.mapper;

import com.tmnhat.projectsservice.model.Projects;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.UUID;

public class ProjectMapper {

    public static Projects mapResultSetToProject(ResultSet rs) throws SQLException {
        return new Projects.Builder()
                .id(rs.getObject("id", UUID.class))
                .name(rs.getString("name"))
                .description(rs.getString("description"))
                .ownerId(rs.getObject("owner_id", UUID.class))
                .deadline(rs.getDate("deadline") != null ? rs.getDate("deadline").toLocalDate() : null)
                .createdAt(rs.getTimestamp("created_at") != null ? rs.getTimestamp("created_at").toLocalDateTime() : null)
                .build();
    }
}
