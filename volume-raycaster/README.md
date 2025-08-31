# Volume Raycaster - Three.js + WebGL

A basic volume raycaster implementation using Three.js and WebGL shaders. This demonstrates volume rendering techniques by ray marching through a 3D texture.

## Features

- **Volume Data Generation**: Creates a 3D noise-based volume with spherical density falloff
- **Ray Marching**: Implements front-to-back compositing for volume rendering
- **Interactive Controls**: Mouse controls for camera rotation and zoom
- **Real-time Rendering**: Smooth 60fps rendering with WebGL

## How It Works

1. **Volume Data**: A 32x32x32 3D texture is generated with RGBA data representing density and color
2. **Ray Casting**: For each pixel, a ray is cast from the camera through the volume
3. **Ray Marching**: The ray samples the volume texture at regular intervals
4. **Compositing**: Colors are accumulated using front-to-back alpha blending

## Technical Details

- **Renderer**: WebGL (WebGPU support would require Three.js r150+ with WebGPURenderer)
- **Shaders**: Custom GLSL vertex and fragment shaders
- **Volume Format**: RGBA 3D texture with density stored in alpha channel
- **Ray-Box Intersection**: Efficient bounding box intersection for performance
- **Step Size**: Configurable sampling rate (currently 0.01 units)

## Usage

1. Open `index.html` in a modern web browser
2. Use mouse to rotate the camera around the volume
3. Use mouse wheel to zoom in/out
4. The volume should appear as a translucent sphere with internal structure

## Browser Requirements

- WebGL 2.0 support (most modern browsers)
- Shader support for 3D textures
- JavaScript enabled

## Future Enhancements

- WebGPU backend for better performance
- Multiple volume datasets
- Transfer functions for different material properties
- Lighting and shadows
- Performance optimizations (level-of-detail, early termination)

## Files

- `index.html` - Main HTML page with Three.js setup
- `script.js` - Main application logic and shaders
- `README.md` - This documentation

## Dependencies

- Three.js r128 (loaded from CDN)
- OrbitControls for camera interaction
