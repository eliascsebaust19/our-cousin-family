import 'dart:io';
import 'dart:typed_data';

import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:path/path.dart' as path;
import 'package:uuid/uuid.dart';

import '../../core/constants/api_constants.dart';
import '../../core/errors/app_exception.dart';

class StorageService {
  final SupabaseClient _client;

  StorageService(this._client);

  /// Upload a file to Supabase Storage
  Future<String> uploadFile({
    required String bucket,
    required String filePath,
    required File file,
    String? contentType,
  }) async {
    try {
      final fileName = '${const Uuid().v4()}${path.extension(file.path)}';
      final fullPath = '$filePath/$fileName';

      await _client.storage.from(bucket).upload(
            fullPath,
            file,
            fileOptions: FileOptions(
              contentType: contentType,
              upsert: false,
            ),
          );

      return fullPath;
    } catch (e) {
      throw StorageException(
        message: 'Failed to upload file: ${e.toString()}',
        originalError: e,
      );
    }
  }

  /// Upload bytes to storage
  Future<String> uploadBytes({
    required String bucket,
    required String filePath,
    required Uint8List bytes,
    String? contentType,
    String extension = '.jpg',
  }) async {
    try {
      final fileName = '${const Uuid().v4()}$extension';
      final fullPath = '$filePath/$fileName';

      await _client.storage.from(bucket).uploadBinary(
            fullPath,
            bytes,
            fileOptions: FileOptions(
              contentType: contentType,
              upsert: false,
            ),
          );

      return fullPath;
    } catch (e) {
      throw StorageException(
        message: 'Failed to upload file: ${e.toString()}',
        originalError: e,
      );
    }
  }

  /// Get a signed URL for a file
  Future<String> getSignedUrl({
    required String bucket,
    required String filePath,
    int expiresIn = 3600, // 1 hour
  }) async {
    try {
      final url = await _client.storage
          .from(bucket)
          .createSignedUrl(filePath, expiresIn);
      return url;
    } catch (e) {
      throw StorageException(
        message: 'Failed to get file URL: ${e.toString()}',
        originalError: e,
      );
    }
  }

  /// Get a public URL
  String getPublicUrl({
    required String bucket,
    required String filePath,
  }) {
    return _client.storage.from(bucket).getPublicUrl(filePath);
  }

  /// Delete a file
  Future<void> deleteFile({
    required String bucket,
    required String filePath,
  }) async {
    try {
      await _client.storage.from(bucket).remove([filePath]);
    } catch (e) {
      throw StorageException(
        message: 'Failed to delete file: ${e.toString()}',
        originalError: e,
      );
    }
  }

  /// List files in a folder
  Future<List<FileObject>> listFiles({
    required String bucket,
    required String folderPath,
  }) async {
    try {
      return await _client.storage.from(bucket).list(path: folderPath);
    } catch (e) {
      throw StorageException(
        message: 'Failed to list files: ${e.toString()}',
        originalError: e,
      );
    }
  }

  /// Upload avatar image
  Future<String> uploadAvatar({
    required String userId,
    required File file,
  }) async {
    return uploadFile(
      bucket: ApiConstants.avatarsBucket,
      filePath: userId,
      file: file,
      contentType: 'image/jpeg',
    );
  }

  /// Upload post media
  Future<String> uploadPostMedia({
    required String familyId,
    required String postId,
    required File file,
    required String mediaType,
  }) async {
    return uploadFile(
      bucket: ApiConstants.postMediaBucket,
      filePath: '$familyId/$postId',
      file: file,
      contentType: mediaType == 'image' ? 'image/jpeg' : 'video/mp4',
    );
  }

  /// Upload memory vault media
  Future<String> uploadMemoryMedia({
    required String familyId,
    required File file,
    required String mediaType,
  }) async {
    return uploadFile(
      bucket: ApiConstants.memoryVaultBucket,
      filePath: '$familyId',
      file: file,
    );
  }
}