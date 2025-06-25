package com.tmnhat.sprintsservice.repository;

import com.tmnhat.common.config.DatabaseConnection;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.SQLException;

public abstract class BaseDAO {
    protected Connection getConnection() throws SQLException {
        return DatabaseConnection.getConnection();
    }

    protected void executeUpdate(String query, SQLConsumer<PreparedStatement> consumer) throws SQLException {
        try (Connection conn = getConnection();
             PreparedStatement stmt = conn.prepareStatement(query)) {
            consumer.accept(stmt);
            stmt.executeUpdate();
        }
    }


    protected <T> T executeQuery(String query, SQLFunction<PreparedStatement, T> function) throws SQLException {
        try (Connection conn = getConnection();
             PreparedStatement stmt = conn.prepareStatement(query)) {
            return function.apply(stmt);
        }
    }


    @FunctionalInterface
    public interface SQLConsumer<T> {
        void accept(T t) throws SQLException;
    }
    @FunctionalInterface
    public interface SQLFunction<T, R> {
        R apply(T t) throws SQLException;
    }
}

