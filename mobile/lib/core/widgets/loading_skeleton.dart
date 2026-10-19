import 'package:flutter/material.dart';
import 'package:shimmer/shimmer.dart';

class LoadingSkeleton extends StatelessWidget {
  final double? width;
  final double? height;
  final double borderRadius;
  final BoxShape shape;

  const LoadingSkeleton({
    super.key,
    this.width,
    this.height,
    this.borderRadius = 8,
    this.shape = BoxShape.rectangle,
  });

  const LoadingSkeleton.circle({
    super.key,
    required double radius,
  })  : width = radius * 2,
        height = radius * 2,
        borderRadius = 0,
        shape = BoxShape.circle;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Shimmer.fromColors(
      baseColor: isDark ? Colors.grey[800]! : Colors.grey[300]!,
      highlightColor: isDark ? Colors.grey[700]! : Colors.grey[100]!,
      child: Container(
        width: width,
        height: height,
        decoration: BoxDecoration(
          color: Colors.white,
          shape: shape,
          borderRadius: shape == BoxShape.circle
              ? null
              : BorderRadius.circular(borderRadius),
        ),
      ),
    );
  }
}

class PostSkeleton extends StatelessWidget {
  const PostSkeleton({super.key});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const LoadingSkeleton.circle(radius: 20),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: const [
                    LoadingSkeleton(width: 140, height: 14),
                    SizedBox(height: 4),
                    LoadingSkeleton(width: 80, height: 10),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          const LoadingSkeleton(width: double.infinity, height: 12),
          const SizedBox(height: 6),
          const LoadingSkeleton(width: 200, height: 12),
          const SizedBox(height: 12),
          const LoadingSkeleton(
            width: double.infinity,
            height: 200,
            borderRadius: 12,
          ),
          const SizedBox(height: 12),
          Row(
            children: const [
              LoadingSkeleton(width: 60, height: 24, borderRadius: 12),
              SizedBox(width: 12),
              LoadingSkeleton(width: 60, height: 24, borderRadius: 12),
              SizedBox(width: 12),
              LoadingSkeleton(width: 60, height: 24, borderRadius: 12),
            ],
          ),
        ],
      ),
    );
  }
}

class ChatMessageSkeleton extends StatelessWidget {
  const ChatMessageSkeleton({super.key});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
      child: Row(
        children: [
          const LoadingSkeleton.circle(radius: 16),
          const SizedBox(width: 8),
          const LoadingSkeleton(width: 180, height: 36, borderRadius: 18),
        ],
      ),
    );
  }
}

class CardSkeleton extends StatelessWidget {
  final double height;

  const CardSkeleton({super.key, this.height = 100});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
      child: LoadingSkeleton(
        width: double.infinity,
        height: height,
        borderRadius: 16,
      ),
    );
  }
}