package com.tmnhat.projectsservice.repository;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.SQLException;

@Component
public abstract class BaseDAO {
    
    @Autowired
    protected DataSource dataSource;
    
    protected Connection getConnection() throws SQLException {
        System.out.println("DEBUG: Using Spring DataSource: " + dataSource);
        Connection conn = dataSource.getConnection();
        System.out.println("DEBUG: Connection URL: " + conn.getMetaData().getURL());
        return conn;
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

