package com.tmnhat.notificationservice.payload;

public class ResponseDataAPI<T> {
    private String status;
    private T data;
    private String message;
    private String error;

    // Constructors
    public ResponseDataAPI() {}

    public ResponseDataAPI(String status, T data) {
        this.status = status;
        this.data = data;
    }

    public ResponseDataAPI(String status, T data, String message) {
        this.status = status;
        this.data = data;
        this.message = message;
    }

    // Static factory methods
    public static <T> ResponseDataAPI<T> success(T data) {
        return new ResponseDataAPI<>("SUCCESS", data);
    }

    public static <T> ResponseDataAPI<T> success(T data, String message) {
        return new ResponseDataAPI<>("SUCCESS", data, message);
    }

    public static <T> ResponseDataAPI<T> successWithoutMeta(T data) {
        return new ResponseDataAPI<>("SUCCESS", data);
    }

    public static <T> ResponseDataAPI<T> failure(String error) {
        ResponseDataAPI<T> response = new ResponseDataAPI<>();
        response.status = "FAILURE";
        response.error = error;
        return response;
    }

    public static <T> ResponseDataAPI<T> failure(String error, String message) {
        ResponseDataAPI<T> response = new ResponseDataAPI<>();
        response.status = "FAILURE";
        response.error = error;
        response.message = message;
        return response;
    }

    public static <T> ResponseDataAPI<T> error(String error) {
        ResponseDataAPI<T> response = new ResponseDataAPI<>();
        response.status = "FAILURE";
        response.error = error;
        return response;
    }

    // Getters and Setters
    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public T getData() {
        return data;
    }

    public void setData(T data) {
        this.data = data;
    }

    public String getMessage() {
        return message;
    }

    public void setMessage(String message) {
        this.message = message;
    }

    public String getError() {
        return error;
    }

    public void setError(String error) {
        this.error = error;
    }
} 