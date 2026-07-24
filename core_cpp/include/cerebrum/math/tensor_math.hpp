#pragma once
#include <vector>
#include <random>
#include <iostream>

namespace cerebrum {
namespace math {

class TensorMath {
public:
    static void simulate_matrix_multiplication(int matrix_size) {
        // Create two random matrices
        std::vector<std::vector<float>> A(matrix_size, std::vector<float>(matrix_size, 1.0f));
        std::vector<std::vector<float>> B(matrix_size, std::vector<float>(matrix_size, 2.0f));
        std::vector<std::vector<float>> C(matrix_size, std::vector<float>(matrix_size, 0.0f));

        // Basic unoptimized matrix multiplication to simulate real CPU load
        for (int i = 0; i < matrix_size; ++i) {
            for (int j = 0; j < matrix_size; ++j) {
                float sum = 0.0f;
                for (int k = 0; k < matrix_size; ++k) {
                    sum += A[i][k] * B[k][j];
                }
                C[i][j] = sum;
            }
        }
        
        // Prevent compiler from optimizing out the loop
        volatile float result = C[0][0];
        (void)result;
    }
};

} // namespace math
} // namespace cerebrum
