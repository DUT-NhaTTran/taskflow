package com.tmnhat.common.config;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.SQLException;

public class DatabaseConnection {
    private static final String URL = System.getenv("DATABASE_URL") != null 
        ? System.getenv("DATABASE_URL") 
        : "jdbc:postgresql://localhost:5432/postgres";
    private static final String USER = System.getenv("SPRING_DATASOURCE_USERNAME") != null 
        ? System.getenv("SPRING_DATASOURCE_USERNAME") 
        : "postgre";
    private static final String PASSWORD = System.getenv("SPRING_DATASOURCE_PASSWORD") != null 
        ? System.getenv("SPRING_DATASOURCE_PASSWORD") 
        : "Nhatvn123";

    public static Connection getConnection() throws SQLException {
        System.out.println("DEBUG: DatabaseConnection URL: " + URL);
        return DriverManager.getConnection(URL, USER, PASSWORD);
    }
    
    private DatabaseConnection(){

    }
    
    public static void main(String[] args) {
        try (Connection conn = getConnection()) {
            if (conn != null) {
                System.out.println("Kết nối đến PostgreSQL thành công!");
            } else {
                System.out.println(" Kết nối thất bại!");
            }
        } catch (SQLException e) {
            System.err.println(" Lỗi kết nối PostgreSQL: " + e.getMessage());
        }
    }
}
