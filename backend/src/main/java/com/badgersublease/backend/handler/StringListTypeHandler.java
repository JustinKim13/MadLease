package com.badgersublease.backend.handler;

import org.apache.ibatis.type.*;
import java.sql.*;
import java.util.*;

//Custom handler for turning postgres array into java list<string> -- needed for mybatis to convert the postgres array to a java list
//jdbc type of postgres array
@MappedJdbcTypes(JdbcType.ARRAY) // tells mybatis to use this handler for postgres arrays
//java type of class
@MappedTypes(List.class)
//the set fields above basically mean that whenever we are dealing with a conversion from postgres array to java list, use these methods
public class StringListTypeHandler extends BaseTypeHandler<List<String>> {

    //turns our db info into a java.sql.array
    //this runs during an insert/update, first checks for param not being null, before calling this
    @Override
    public void setNonNullParameter(PreparedStatement ps, int i, List<String> parameter, JdbcType jdbcType) throws SQLException {
        //grabs our db connection
        Connection conn = ps.getConnection();
        //creates the array to insert into our db, turns parameter(List) into a text array
        //reason for size 0 is basically just for saying what type of array we want
        Array array = conn.createArrayOf("text", parameter.toArray(new String [0]));
        ps.setArray(i, array);
    }
    //following three methods are for reading the results
    //this is when mybatis maps by column name
    @Override
    public List<String> getNullableResult(ResultSet rs, String columnName) throws SQLException {
        //gets result by col name from our result set
        return toList(rs.getArray(columnName));
    }
    //this is when mybatis maps by column index
    @Override
    public List<String> getNullableResult(ResultSet rs, int columnIndex) throws SQLException {
        //gets result by index from our result set
        return toList(rs.getArray(columnIndex));
    }
    //this is when like a routine is executed when you have in, out or inout params(we most likely wont be using anything related to this
    @Override
    public List<String> getNullableResult(CallableStatement cs, int columnIndex) throws SQLException {
        return toList(cs.getArray(columnIndex));
    }

    //private method, turns an sql array into a List
    private List<String> toList(Array arr) throws SQLException {
        //no need to convert if nothing to convert
        if (arr == null) return null;
        //get String[] array, this is the "base" conversion, ie basically 1-1 with whats stored
        String[] strings = (String[]) arr.getArray();
        //turn array into List and return
        return Arrays.asList(strings);
    }
}
