#version 330 core

// Uniforms
uniform float iTime;
uniform vec2  iResolution;
uniform vec2  iMouse;

// 2D rotation function
mat2 rot2D(float angle) 
{
    return mat2(cos(angle), -sin(angle), sin(angle), cos(angle));
}

float smin( float a, float b, float k )
{
    k *= 6.0;
    float h = max( k-abs(a-b), 0.0 )/k;
    return min(a,b) - h*h*h*k*(1.0/6.0);
}

// function to generate cycling color palettes
// https://iquilezles.org/articles/palettes/
// http://dev.thi.ng/gradients/
vec3 palette(float t)
{
	vec3 a = vec3(0.5, 0.5, 0.5);
	vec3 b = vec3(0.5, 0.5, 0.5); 
	vec3 c = vec3(1.0, 1.0, 1.0);
	vec3 d = vec3(0.263, 0.416, 0.557);
	return a + b*cos( 6.28318*(c*t+d));
}

float sdSphere(vec3 point, float radius)
{
	return length(point) - radius;
}

float sdCube(vec3 point, vec3 sidesHalfLengths)
{
	vec3 q = abs(point) - sidesHalfLengths;
	return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0);
}

// Distance to the scene
float map(vec3 p)
{

	vec3 q = p;
	mat2 rotationMatrix = rot2D(iTime);
	q.xy *= rotationMatrix;

	vec3 spherePos = vec3(1.0, 0.0, 0.0); // Sphere position
	float sphereSD = sdSphere(p - spherePos, 0.1);	 // Sphere SDF

	vec3 cubePos = vec3(2.0*cos(iTime), 2.0*sin(iTime), 0.0); // Cube position
	cubePos.xy *= rotationMatrix;
	cubePos = vec3(0.0, 0.0, 0.0);
	float cubeSD = sdCube(q - cubePos, vec3(0.1));	// Cube SDF

	float ground = p.y + 0.75; // Distance to the ground

	// Closest distance to the scene
	return smin(ground, smin(sphereSD, cubeSD, 0.1), 0.1);
}

// Outputs colors in RGBA
out vec4 FragColor;

void main()
{
	// uv coordinates originally go from 0 to 1.
	// with the following operations, we transform the coordinates so they go from -1 to 1
	// and the center of the canvas is now (0, 0).
	vec2 uv0 = gl_FragCoord.xy / iResolution.xy * 2.0 - 1.0;

	vec2 mouseUV = iMouse.xy / iResolution.xy * 2.0 - 1.0;

	// Scale the u coordinate so that its interval from -1 to 1 spans the same number of pixels as the y coordinate.
	uv0.x *= iResolution.x / iResolution.y;
	vec3 col = vec3(0.0);

	vec3 ro = vec3(0, 0, -3); // ray origin
	vec3 rd = normalize(vec3(uv0, abs(ro.z)));  // ray direction for the give

	float t = 0.0; // total distance travelled

	// Vertical camera rotation
	ro.yz *= rot2D(-mouseUV.y*3.14159);
	rd.yz *= rot2D(-mouseUV.y*3.14159);

	// Horizontal camera rotation
	rd.xz *= rot2D(-mouseUV.x*3.14159);
	ro.xz *= rot2D(-mouseUV.x*3.14159);

	// Raymarching
	for (int i = 0; i < 80; i++)
	{
		vec3 p = ro + rd * t; // Position of the end of the ray

		float d = map(p);	  // Current distance to the closest object

		t += d;				  // Accumulate the distance

		if (d < 0.001 || t > 100.)
		{
			break; // Early stop of the iteration if the ray is close enough
		}

		col = vec3(i)/float(80); // Color based on iteration
	}

    col = vec3(t * 0.1); // Depth-buffer (color based on distance)

	FragColor = vec4(col, 1.0);
}