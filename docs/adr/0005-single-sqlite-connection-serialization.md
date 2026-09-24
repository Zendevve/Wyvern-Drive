# Single SQLite connection as serialization mechanism

The store holds exactly one open connection with immediate transactions. Reciprocal-move cycle safety rests on this serialization: concurrent conflicting moves contend on the single connection and the loser fails honestly instead of interleaving. A pool would reintroduce the interleavings the design eliminates; health checks bounded by a 2-second deadline tolerate waiting behind one short write.
