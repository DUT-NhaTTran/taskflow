package com.tmnhat.common.payload;

import com.fasterxml.jackson.annotation.JsonInclude;

@JsonInclude(JsonInclude.Include.NON_NULL)
public class ResponseDataAPI {
    private String status;
    private Object data;
    private Object error;
    private Object meta;

    public ResponseDataAPI() {}

    public ResponseDataAPI(String status, Object data, Object error, Object meta) {
        this.status = status;
        this.data = data;
        this.error = error;
        this.meta = meta;
    }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public Object getData() { return data; }
    public void setData(Object data) { this.data = data; }

    public Object getError() { return error; }
    public void setError(Object error) { this.error = error; }

    public Object getMeta() { return meta; }
    public void setMeta(Object meta) { this.meta = meta; }

    public static ResponseDataAPI success(Object data, Object meta) {
        return new ResponseDataAPI("SUCCESS", data, null, meta);
    }

    public static ResponseDataAPI successWithoutMeta(Object data) {
        return new ResponseDataAPI("SUCCESS", data, null, null);
    }

    public static ResponseDataAPI successWithoutMetaAndData() {
        return new ResponseDataAPI("SUCCESS", null, null, null);
    }

    public static ResponseDataAPI error(Object error) {
        return new ResponseDataAPI("FAILURE", null, error, null);
    }
}
