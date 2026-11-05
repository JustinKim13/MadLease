package com.badgersublease.backend.service;

import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.auth.FirebaseAuthException;
import com.google.firebase.auth.FirebaseToken;
import com.google.firebase.auth.UserRecord;
import org.springframework.stereotype.Service;

@Service
public class AuthService {

    public String verifyTokenAndGetUid(String idToken) {
        try {
            FirebaseToken decodedToken = FirebaseAuth.getInstance().verifyIdToken(idToken);
            return decodedToken.getUid();
        } catch (FirebaseAuthException e) {
            return null;
        } catch (Exception e) {
            return null;
        }
    }

    public FirebaseToken verifyToken(String idToken) {
        try {
            return FirebaseAuth.getInstance().verifyIdToken(idToken);
        } catch (FirebaseAuthException e) {
            throw new RuntimeException("Invalid Firebase token", e);
        }
    }

    public UserRecord getUserByUid(String uid) {
        try {
            return FirebaseAuth.getInstance().getUser(uid);
        } catch (FirebaseAuthException e) {
            throw new RuntimeException("Failed to get user from Firebase", e);
        }
    }
    public boolean deleteUserByUid(String uid){
        try {
            FirebaseAuth.getInstance().deleteUser(uid);
            return true;
        } catch (Exception e) {
            throw new RuntimeException("Error deleting user: " + uid, e);
        }
    }
} 