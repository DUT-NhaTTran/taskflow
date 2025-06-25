package com.tmnhat.common.exception;

import com.tmnhat.common.payload.ResponseDataAPI;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
public class GlobalExceptionHandler {

    //Xử lý lỗi request không hợp lệ (400)
    @ExceptionHandler(BadRequestException.class)
    public ResponseEntity<ResponseDataAPI> handleBadRequest(BadRequestException ex) {
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(ResponseDataAPI.error(ex.getMessage()));
    }

    //Xử lý lỗi khi không tìm thấy tài nguyên (404)
    @ExceptionHandler(ResourceNotFoundException.class)
    public ResponseEntity<ResponseDataAPI> handleResourceNotFound(ResourceNotFoundException ex) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(ResponseDataAPI.error(ex.getMessage()));
    }

    //Xử lý lỗi database (500)
    @ExceptionHandler(DatabaseException.class)
    public ResponseEntity<ResponseDataAPI> handleDatabaseException(DatabaseException ex) {
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(ResponseDataAPI.error("Database error: " + ex.getMessage()));
    }

    //Xử lý lỗi chung (500)
    @ExceptionHandler(Exception.class)
    public ResponseEntity<ResponseDataAPI> handleGlobalException(Exception ex) {
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(ResponseDataAPI.error("Internal Server Error"));
    }
}
